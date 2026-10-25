// LANZA account: one per person, no password. People sign in with Google or Strava; both can be
// linked to the same account. The app keeps a random session token; the server maps it to the account.
//   sess/<token>          → { acct, at }
//   acct/<id>             → { id, name, picture, links: { google, strava }, created_at }
//   link/google:<sub>     → id        link/strava:<athleteId> → id
// Kept separate from Netlify Blobs so it can be tested with any store.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
// Sign-ins started from the iPhone home-screen app finish in Safari; the result waits here for the app.
export const HANDOFF_RE = /^gh\.[0-9a-f-]{20,60}$/i;
const HANDOFF_MS = 20 * 60e3;

const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, '0')).join('');
const shortName = (first, last) => `${String(first || '').trim()} ${String(last || '').trim().slice(0, 1)}${last ? '.' : ''}`.trim().slice(0, 40);
const pub = (a) => a && { id: a.id, name: a.name, picture: a.picture || null, google: !!(a.links && a.links.google), strava: !!(a.links && a.links.strava) };

// The account a session token belongs to, or null.
export async function accountOf(store, token) {
  if (!/^[0-9a-f]{40,80}$/.test(String(token || ''))) return null;
  const s = await store.get(`sess/${token}`, { type: 'json' });
  return s ? store.get(`acct/${s.acct}`, { type: 'json' }) : null;
}

// Find the account for a provider id, link it to the signed-in account, or create a new one.
async function upsert(store, kind, pid, profile, token) {
  const linkKey = `link/${kind}:${pid}`, linked = await store.get(linkKey, { type: 'text' });
  const current = token ? await accountOf(store, token) : null;
  let acct;
  if (linked) acct = await store.get(`acct/${linked}`, { type: 'json' });
  else if (current) acct = current; // signed in already: this provider joins the same account
  if (!acct) acct = { id: 'u' + rand(10), name: profile.name || 'Athlete', picture: profile.picture || null, links: {}, created_at: new Date().toISOString() };
  acct.links = { ...(acct.links || {}), [kind]: String(pid) };
  if (!acct.picture && profile.picture) acct.picture = profile.picture;
  if ((!acct.name || acct.name === 'Athlete') && profile.name) acct.name = profile.name;
  await store.setJSON(`acct/${acct.id}`, acct);
  await store.set(linkKey, acct.id);
  // Reuse the session when it already points at this account; otherwise start a new one.
  let sess = token && current && current.id === acct.id ? token : null;
  if (!sess) { sess = rand(24); await store.setJSON(`sess/${sess}`, { acct: acct.id, at: Date.now() }); }
  return { token: sess, account: pub(acct) };
}

export async function handle(req, store, { env = () => '', fetchImpl = fetch, handoffs = store } = {}) {
  if (req.method !== 'POST') return [{ error: 'Use POST' }, 405];
  let body;
  try { body = await req.json(); } catch { return [{ error: 'Invalid JSON' }, 400]; }
  const { action } = body;

  if (action === 'me') {
    const a = await accountOf(store, body.token);
    return a ? [{ account: pub(a) }, 200] : [{ error: 'Signed out' }, 401];
  }
  if (action === 'signout') {
    if (/^[0-9a-f]{40,80}$/.test(String(body.token || ''))) await store.delete(`sess/${body.token}`);
    return [{ ok: true }, 200];
  }
  if (action === 'claim') {
    const key = String(body.handoff || '');
    if (!HANDOFF_RE.test(key)) return [{ error: 'Bad hand-off' }, 400];
    const row = await handoffs.get(`acct-${key}`, { type: 'json' });
    if (!row) return [{ pending: true }, 200];
    await handoffs.delete(`acct-${key}`);
    if (Date.now() - row.at > HANDOFF_MS) return [{ pending: true }, 200];
    return [row.result, 200];
  }

  // Google: the app sends the one-time code; the secret stays here.
  if (action === 'google') {
    const id = env('GOOGLE_CLIENT_ID'), secret = env('GOOGLE_CLIENT_SECRET');
    if (!id || !secret) return [{ error: 'Google sign-in is not set up on this site yet.' }, 503];
    const params = new URLSearchParams({ code: String(body.code || ''), client_id: id, client_secret: secret, redirect_uri: String(body.redirect_uri || ''), grant_type: 'authorization_code' });
    const r = await fetchImpl(GOOGLE_TOKEN_URL, { method: 'POST', body: params });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id_token) return [{ error: d.error_description || 'Google rejected the sign-in.' }, 401];
    // The ID token came straight from Google over TLS in exchange for our secret, so its claims can be read as is.
    let c = {};
    try { c = JSON.parse(Buffer.from(d.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch {}
    if (!c.sub || c.aud !== id) return [{ error: 'Google sign-in failed.' }, 401];
    const result = await upsert(store, 'google', c.sub, { name: shortName(c.given_name || c.name, c.family_name), picture: c.picture }, body.token);
    if (body.handoff) {
      const key = String(body.handoff);
      if (!HANDOFF_RE.test(key)) return [{ error: 'Bad hand-off' }, 400];
      await handoffs.setJSON(`acct-${key}`, { at: Date.now(), result });
      return [{ ok: true, handoff: true }, 200];
    }
    return [result, 200];
  }

  // Strava: a valid Strava token proves the athlete; the account is created or linked.
  if (action === 'strava') {
    let a = null;
    try {
      const r = await fetchImpl('https://www.strava.com/api/v3/athlete', { headers: { authorization: `Bearer ${body.access_token}` } });
      if (r.ok) a = await r.json();
    } catch { /* handled below */ }
    if (!a || !a.id) return [{ error: 'Strava sign-in expired. Connect again.' }, 401];
    return [await upsert(store, 'strava', a.id, { name: shortName(a.firstname, a.lastname), picture: a.profile_medium || a.profile }, body.token), 200];
  }

  return [{ error: 'Unknown action' }, 400];
}
