// Privacy-friendly usage counts: no ids, no cookies, just daily totals per event and source.
export const EVENTS = ['open', 'install', 'session', 'strava_post', 'team_join', 'invite_open', 'pro', 'story', 'ad_offer', 'ad_view', 'ad_nofill'];
const clean = (s) => String(s || 'direct').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'direct';
const day = (d = new Date()) => d.toISOString().slice(0, 10);

// Running totals for the owner: accounts (and how they sign in), teams and team members.
async function totals({ accounts, teams } = {}) {
  const keys = async (st, prefix) => (st ? (await st.list({ prefix })).blobs.map((b) => b.key) : []);
  const out = {};
  if (accounts) {
    const rows = (await Promise.all((await keys(accounts, 'acct/')).map((k) => accounts.get(k, { type: 'json' })))).filter((a) => a && !a.merged_into);
    const links = (a) => a.links || {};
    out.accounts = rows.length;
    out.google = rows.filter((a) => links(a).google).length;
    out.strava = rows.filter((a) => links(a).strava).length;
    out.both = rows.filter((a) => links(a).google && links(a).strava).length;
    out.joined = rows.map((a) => String(a.created_at || '').slice(0, 10)).filter(Boolean).sort();
  }
  if (teams) {
    const regs = (await Promise.all((await keys(teams, 'members/')).map((k) => teams.get(k, { type: 'json' })))).filter(Boolean);
    out.teams = (await keys(teams, 'meta/')).length;
    out.members = regs.reduce((n, r) => n + Object.keys(r).length, 0);
  }
  return out;
}

export async function handle(req, store, adminKey, stores) {
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
    return [{ days: out, totals: await totals(stores).catch(() => ({})), at: new Date().toISOString() }, 200];
  }
  return [{ error: 'Use GET or POST' }, 405];
}
