// Privacy-friendly usage counts: no ids, no cookies, just daily totals per event and source.
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
    out.team_members = regs.reduce((n, r) => n + (r ? Object.keys(r).length : 0), 0);
  }
  return out;
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
    return [{ days: out, people: await people(accounts, teams).catch(() => null), at: new Date().toISOString() }, 200];
  }
  return [{ error: 'Use GET or POST' }, 405];
}
