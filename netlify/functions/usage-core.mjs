// Privacy-friendly usage counts: no ids, no cookies, just daily totals per event and source.
import { isoWeek } from './team-core.mjs';

export const EVENTS = ['open', 'install', 'session', 'strava_post', 'team_join', 'invite_open', 'pro', 'story', 'ad_offer', 'ad_view', 'ad_nofill'];
const clean = (s) => String(s || 'direct').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'direct';
const day = (d = new Date()) => d.toISOString().slice(0, 10);

// Totals for the owner's dashboard: accounts (Google or Strava sign-in) and teams. Counts only, no names.
export async function people(accounts, teams) {
  const out = { accounts: 0, google: 0, strava: 0, new_today: 0, new_7d: 0, teams: 0, team_members: 0 };
  if (accounts) {
    const { blobs } = await accounts.list({ prefix: 'acct/' }), now = Date.now();
    const rows = await Promise.all(blobs.slice(0, 5000).map((b) => accounts.get(b.key, { type: 'json' }).catch(() => null)));
    for (const a of rows) {
      if (!a || a.merged_into) continue;
      out.accounts++;
      if (a.links && a.links.google) out.google++;
      if (a.links && a.links.strava) out.strava++;
      const age = now - Date.parse(a.created_at || 0);
      if (age < 864e5) out.new_today++;
      if (age < 7 * 864e5) out.new_7d++;
    }
  }
  if (teams) {
    const { blobs } = await teams.list({ prefix: 'members/' });
    out.teams = blobs.length;
    const regs = await Promise.all(blobs.slice(0, 2000).map((b) => teams.get(b.key, { type: 'json' }).catch(() => null)));
    out.team_members = regs.reduce((n, r) => n + (r ? Object.values(r).filter((m) => !m.removed && !m.left_at && !m.hidden).length : 0), 0);
  }
  return out;
}

// Every team on the platform, for the owner picking Founding Teams: name, members, captains and how
// much it trains. Sessions are counted from their keys (CODE/YYYY-Www/id), so no session is read.
export async function teamList(teams) {
  if (!teams) return [];
  const { blobs } = await teams.list(), by = {};
  const t = (code) => (by[code] = by[code] || { code, sessions: 0, sessions_4w: 0, weeks: new Set() });
  const recent = new Set([0, 1, 2, 3].map((i) => isoWeek(new Date(Date.now() - i * 7 * 864e5))));
  for (const { key } of blobs) {
    let m = key.match(/^(meta|members)\/([A-Z0-9-]{4,20})$/);
    if (m) { t(m[2]); continue; }
    m = key.match(/^([A-Z0-9-]{4,20})\/(\d{4}-W\d{2})\//);
    if (m) { const x = t(m[1]); x.sessions++; x.weeks.add(m[2]); if (recent.has(m[2])) x.sessions_4w++; }
  }
  const list = Object.values(by).slice(0, 3000);
  return Promise.all(list.map(async (x) => {
    const [meta, reg] = await Promise.all([teams.get(`meta/${x.code}`, { type: 'json' }).catch(() => null), teams.get(`members/${x.code}`, { type: 'json' }).catch(() => null)]);
    const ms = Object.values(reg || {}), weeks = [...x.weeks].sort();
    const joined = ms.map((m) => m.joined_at).filter(Boolean).sort();
    return {
      code: x.code, name: (meta && meta.name) || null, color: (meta && meta.color) || null,
      members: ms.filter((m) => !m.removed && !m.left_at && !m.hidden).length,
      captains: (meta && Array.isArray(meta.captains) ? meta.captains.length : 0) || (meta && meta.cap ? 1 : 0),
      sessions: x.sessions, sessions_4w: x.sessions_4w, active_weeks: weeks.length,
      first_week: weeks[0] || null, last_week: weeks[weeks.length - 1] || null,
      created_at: (meta && meta.created_at) || joined[0] || null
    };
  }));
}

export async function handle(req, store, adminKey, { accounts, teams } = {}) {
  const url = new URL(req.url);
  if (req.method === 'POST') {
    let b; try { b = await req.json(); } catch { return [{ error: 'Invalid JSON' }, 400]; }
    if (!EVENTS.includes(b.e)) return [{ error: 'Unknown event' }, 400];
    const k = `day/${day()}`, d = (await store.get(k, { type: 'json' })) || {};
    const src = clean(b.src); d[b.e] = d[b.e] || {}; d[b.e][src] = (d[b.e][src] || 0) + 1;
    await store.setJSON(k, d);
    return [{ ok: true }, 200];
  }
  if (req.method === 'GET') {
    if (!adminKey || url.searchParams.get('key') !== adminKey) return [{ error: 'Wrong key' }, 403];
    const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days')) || 30)), out = [];
    for (let i = 0; i < days; i++) { const k = day(new Date(Date.now() - i * 864e5)); out.push({ day: k, ...((await store.get(`day/${k}`, { type: 'json' })) || {}) }); }
    return [{ days: out, people: await people(accounts, teams).catch(() => null), teams: await teamList(teams).catch(() => null), at: new Date().toISOString() }, 200];
  }
  return [{ error: 'Use GET or POST' }, 405];
}
