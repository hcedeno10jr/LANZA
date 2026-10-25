// Privacy-friendly usage counts: no ids, no cookies, just daily totals per event and source.
export const EVENTS = ['open', 'install', 'session', 'strava_post', 'team_join', 'invite_open', 'pro', 'story', 'ad_offer', 'ad_view', 'ad_nofill'];
const clean = (s) => String(s || 'direct').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30) || 'direct';
const day = (d = new Date()) => d.toISOString().slice(0, 10);

export async function handle(req, store, adminKey) {
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
    return [{ days: out }, 200];
  }
  return [{ error: 'Use GET or POST' }, 405];
}
