// History backup: a copy of each athlete's sessions, keyed by their LANZA account (or, for older
// apps, their Strava athlete id). The account or Strava token proves who is asking.
import { sanitize } from './team-core.mjs';
import { accountOf } from './account-core.mjs';

const MAX_SESSIONS = 5000;
const num = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const str = (v, n) => (v == null ? '' : String(v)).slice(0, n);

function cleanShape(sh) {
  if (!sh || sh.type !== 'path' || !Array.isArray(sh.pts)) return null;
  const pts = sh.pts.slice(0, 600).filter((p) => Array.isArray(p) && p.length === 2).map(([x, y]) => [+num(x, -500, 500, 0).toFixed(3), +num(y, -500, 500, 0).toFixed(3)]);
  return pts.length > 2 ? { type: 'path', pts } : null;
}
// Everything the app keeps per session; the scored fields go through the same sanitize as the team board.
export function cleanSession(s) {
  const b = sanitize(s || {});
  return {
    ...b,
    duration_s: Math.round(num(s.duration_s, 0, 86400, 0)),
    title: str(s.title, 80),
    shape: cleanShape(s.shape),
    team_shared: s.team_shared ? str(s.team_shared, 200) : null
  };
}
export function cleanProfile(p) {
  p = p || {};
  return { name: str(p.name, 40), team: str(p.team, 20).toUpperCase().replace(/[^A-Z0-9-]/g, ''), teamName: str(p.teamName, 30),
    teams: (Array.isArray(p.teams) ? p.teams : []).slice(0, 10).map((t) => ({ code: str(t && t.code, 20).toUpperCase().replace(/[^A-Z0-9-]/g, ''), name: str(t && t.name, 30), color: /^#[0-9a-f]{6}$/i.test(t && t.color) ? t.color : '', owner: !!(t && t.owner), ck: /^[A-Za-z0-9-]{8,64}$/.test(t && t.ck) ? t.ck : '' })).filter((t) => t.code),
    goal: Math.round(num(p.goal, 1, 7, 3)) };
}
// Union by session id; the newer copy (the one just sent) wins.
export function merge(older, newer) {
  const by = new Map(older.map((s) => [s.id, s]));
  newer.forEach((s) => by.set(s.id, s));
  return [...by.values()].sort((a, b) => a.created_at.localeCompare(b.created_at)).slice(-MAX_SESSIONS);
}

export async function handle(req, store, fetchImpl = fetch, accounts = null) {
  if (req.method !== 'POST') return [{ error: 'Use POST' }, 405];
  let body;
  try { body = await req.json(); } catch { return [{ error: 'Invalid JSON' }, 400]; }
  let key = null, legacy = null;
  if (body.account_token && accounts) {
    const a = await accountOf(accounts, body.account_token);
    if (!a) return [{ error: 'Signed out. Sign in again.' }, 401];
    key = `user/${a.id}`;
    // History saved before accounts existed (keyed by Strava athlete) joins the account's.
    // So does the history of any account merged into this one.
    legacy = [...(a.links && a.links.strava ? [`athlete/${a.links.strava}`] : []), ...(a.aliases || []).map((x) => `user/${x}`)];
  } else {
    if (!body.access_token) return [{ error: 'Sign in to use the backup.' }, 401];
    let athleteId = null;
    try {
      const r = await fetchImpl('https://www.strava.com/api/v3/athlete', { headers: { authorization: `Bearer ${body.access_token}` } });
      if (r.ok) athleteId = (await r.json()).id;
    } catch { /* handled below */ }
    if (!athleteId) return [{ error: 'Strava sign-in expired. Connect again.' }, 401];
    key = `athlete/${athleteId}`;
  }
  for (const from of legacy || []) {
    const old = await store.get(from, { type: 'json' });
    if (old && old.sessions && old.sessions.length) {
      const cur = (await store.get(key, { type: 'json' })) || { sessions: [] };
      await store.setJSON(key, { sessions: merge(old.sessions, cur.sessions || []), profile: cur.profile || old.profile || null, updated_at: new Date().toISOString() });
      await store.setJSON(from, { ...old, sessions: [], moved_to: key });
    }
  }

  if (body.action === 'load') {
    const d = await store.get(key, { type: 'json' });
    return [d || { sessions: [], profile: null, updated_at: null }, 200];
  }
  if (body.action === 'save') {
    if (!Array.isArray(body.sessions)) return [{ error: 'sessions must be a list' }, 400];
    const incoming = body.sessions.slice(-MAX_SESSIONS).map(cleanSession).filter((s) => s.id);
    const prev = (await store.get(key, { type: 'json' })) || { sessions: [] };
    const d = { sessions: merge(prev.sessions || [], incoming), profile: cleanProfile(body.profile), updated_at: new Date().toISOString() };
    await store.setJSON(key, d);
    return [{ ok: true, count: d.sessions.length, updated_at: d.updated_at }, 200];
  }
  if (body.action === 'delete') {
    await store.delete(key);
    return [{ ok: true }, 200];
  }
  return [{ error: 'Unknown action' }, 400];
}
