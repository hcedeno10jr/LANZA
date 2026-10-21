// Team board logic, kept separate from Netlify Blobs so it can be tested with any store.
const CODE_RE = /^[A-Z0-9-]{4,20}$/;
const num = (v, lo, hi, d = 0) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const WIND = { 1: 1.0, 2: 1.1, 3: 1.25, 4: 1.4, 5: 1.6 };
const WET = { 1: 1.0, 2: 1.1, 3: 1.2 };
// Throw tags; must match THROWS / STYLES in index.html.
const THROW_IDS = ['backhand', 'forehand', 'hammer', 'scoober', 'thumber', 'push', 'mixed'];
const STYLE_IDS = ['flat', 'io', 'oi', 'touch', 'huck', 'blade', 'low', 'high', 'off', 'pull'];

// Skill Score, a 0–100 rating. Must match scoreOf() in index.html.
// A = (makes + 5) / (attempts + 10); D = size x distance x wind x wet;
// Level = 1–10 on a log scale of D; Score = round(100 x A x (0.5 + 0.05 x Level)).
const D_MIN = 0.56, D_MAX = 9.6;
export function skillScore({ makes, attempts, difficulty, wind_rating = 1, wet_rating = 1 }) {
  const A = (makes + 5) / (attempts + 10);
  const D = Math.max(D_MIN, difficulty * (WIND[wind_rating] || 1) * (WET[wet_rating] || 1));
  const level = Math.min(10, Math.max(1, 1 + 9 * Math.log(D / D_MIN) / Math.log(D_MAX / D_MIN)));
  return Math.round(100 * A * (0.5 + 0.05 * level));
}

export function isoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const y = d.getUTCFullYear();
  const w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

// Cleans what the phone sent and recomputes the score so nobody can post a made-up number.
export const CHALLENGE_KINDS = ['throws', 'makes', 'sessions'];
export const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);

export function sanitize(s) {
  const attempts = Math.round(num(s.attempts, 1, 2000, 1));
  const makes = Math.round(num(s.makes, 0, attempts));
  const difficulty = num(s.difficulty, 0.5, 6, 1);
  const wind_rating = Math.round(num(s.wind_rating, 1, 5, 1));
  const wet_rating = Math.round(num(s.wet_rating, 1, 3, 1));
  const accuracy = makes / attempts;
  const created = new Date(s.created_at);
  return {
    id: String(s.id || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 40),
    created_at: isNaN(created) ? new Date().toISOString() : created.toISOString(),
    distance_m: Math.round(num(s.distance_m, 1, 100, 20)),
    target: String(s.target || '').slice(0, 30),
    target_ratio: num(s.target_ratio, 0.1, 500, 0),
    difficulty, attempts, makes, accuracy, wind_rating, wet_rating,
    skill_score: skillScore({ makes, attempts, difficulty, wind_rating, wet_rating }),
    best_streak: Math.round(num(s.best_streak, 0, attempts)),
    throw: THROW_IDS.includes(s.throw) ? s.throw : 'mixed',
    styles: Array.isArray(s.styles) ? [...new Set(s.styles.filter((x) => STYLE_IDS.includes(x)))] : [],
    strava_activity_id: s.strava_activity_id ? String(s.strava_activity_id).replace(/\D/g, '').slice(0, 20) : null
  };
}

export async function handle(req, store, fetchImpl = fetch) {
  const url = new URL(req.url);
  if (req.method === 'GET') {
    const code = (url.searchParams.get('code') || '').toUpperCase();
    if (!CODE_RE.test(code)) return [{ error: 'Team code must be 4-20 letters, numbers or dashes.' }, 400];
    const weeks = Math.round(num(url.searchParams.get('weeks'), 1, 52, 4));
    const keys = [];
    for (let i = 0; i < weeks; i++) {
      const { blobs } = await store.list({ prefix: `${code}/${isoWeek(new Date(Date.now() - i * 7 * 864e5))}/` });
      keys.push(...blobs.map((b) => b.key));
    }
    const rows = (await Promise.all(keys.map((k) => store.get(k, { type: 'json' })))).filter(Boolean)
      // Rescore on read so sessions saved under an older formula compare fairly.
      .map((r) => ({ ...r, skill_score: skillScore(r) }));
    rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const challenge = await store.get(`challenge/${code}/${monthKey()}`, { type: 'json' });
    const meta = await store.get(`meta/${code}`, { type: 'json' });
    return [{ code, name: (meta && meta.name) || null, color: (meta && meta.color) || null, season: (meta && meta.season) || null, has_captain: !!(meta && meta.cap), week: isoWeek(new Date()), month: monthKey(), challenge: challenge || null, sessions: rows }, 200];
  }
  if (req.method === 'POST') {
    let body;
    try { body = await req.json(); } catch { return [{ error: 'Invalid JSON' }, 400]; }
    const code = String(body.code || '').toUpperCase();
    if (!CODE_RE.test(code)) return [{ error: 'Invalid team code' }, 400];
    // Team name. Anyone on the team can set or change it.
    if (body.action === 'name') {
      const name = String(body.team_name || '').replace(/\s+/g, ' ').trim().slice(0, 30);
      if (!name) return [{ error: 'Add a team name' }, 400];
      const color = /^#[0-9a-f]{6}$/i.test(body.team_color || '') ? body.team_color.toLowerCase() : '';
      const prev = (await store.get(`meta/${code}`, { type: 'json' })) || {};
      const meta = { ...prev, name, color, by: String(body.name || '').trim().slice(0, 40), set_at: new Date().toISOString() };
      await store.setJSON(`meta/${code}`, meta);
      return [{ ok: true, name, color }, 200];
    }
    // Season dates, set by the team's captains; the Season view counts sessions between them.
    if (body.action === 'season') {
      const se = body.season || {}, day = /^\d{4}-\d{2}-\d{2}$/;
      if (!day.test(se.start || '') || !day.test(se.end || '') || se.end < se.start) return [{ error: 'Check the season dates' }, 400];
      const prev = (await store.get(`meta/${code}`, { type: 'json' })) || {};
      // Captains hold a key; the first one to save a season sets it, and captain invite links share it.
      const cap = String(body.cap || '');
      if (!/^[A-Za-z0-9-]{8,64}$/.test(cap)) return [{ error: 'Only captains can change the season' }, 403];
      if (prev.cap && prev.cap !== cap) return [{ error: 'Only captains can change the season' }, 403];
      const season = { name: String(se.name || '').trim().slice(0, 40) || `${se.start.slice(0, 4)} season`, start: se.start, end: se.end };
      await store.setJSON(`meta/${code}`, { ...prev, season, cap: prev.cap || cap });
      return [{ ok: true, season }, 200];
    }
    // Monthly team challenge, e.g. 2000 throws as a team. Anyone on the team can set it.
    if (body.action === 'challenge') {
      const kind = CHALLENGE_KINDS.includes(body.kind) ? body.kind : 'throws';
      const target = Math.round(num(body.target, 1, 1e6, 0));
      if (!target) return [{ error: 'Set a number' }, 400];
      const c = { kind, target, by: String(body.name || '').trim().slice(0, 40), month: monthKey(), set_at: new Date().toISOString() };
      await store.setJSON(`challenge/${code}/${c.month}`, c);
      return [{ ok: true, challenge: c }, 200];
    }
    const s = sanitize(body.session || {});
    if (!s.id) return [{ error: 'Missing session id' }, 400];
    let athlete = { name: String(body.name || 'Athlete').trim().slice(0, 40) || 'Athlete', strava_id: null, verified: false };
    // A Strava token proves who posted the session, so the board can mark it as verified.
    if (body.access_token) {
      try {
        const r = await fetchImpl('https://www.strava.com/api/v3/athlete', { headers: { authorization: `Bearer ${body.access_token}` } });
        if (r.ok) {
          const a = await r.json();
          athlete = { name: `${a.firstname || ''} ${(a.lastname || '').slice(0, 1)}${a.lastname ? '.' : ''}`.trim() || athlete.name, strava_id: a.id, verified: true };
        }
      } catch { /* keep the unverified name */ }
    }
    const athlete_key = athlete.strava_id ? `strava:${athlete.strava_id}` : `name:${athlete.name.toLowerCase()}`;
    const row = { ...s, ...athlete, athlete_key };
    await store.setJSON(`${code}/${isoWeek(new Date(s.created_at))}/${s.id}`, row);
    return [{ ok: true, session: row }, 200];
  }
  return [{ error: 'Use GET or POST' }, 405];
}
