// Small helpers shared by the Kinetic Metrics functions.
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

export const env = (k) => (process.env[k] || '').trim();

// Strava's read limit is 300 calls per 15 minutes for the whole app, so "who is this token?" lookups
// (team board, backup, account, Pro) are remembered for a few minutes per warm function instance.
const ATHLETE_TTL = 10 * 60e3, athleteCache = new Map();
export async function stravaAthlete(token, fetchImpl = fetch) {
  if (!token) return null;
  const hit = athleteCache.get(token);
  if (hit && Date.now() - hit.at < ATHLETE_TTL) return hit.a;
  const r = await fetchImpl('https://www.strava.com/api/v3/athlete', { headers: { authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  const a = await r.json();
  if (athleteCache.size > 500) athleteCache.clear();
  athleteCache.set(token, { a, at: Date.now() });
  return a;
}
