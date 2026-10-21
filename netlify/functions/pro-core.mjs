// LANZA Pro: a Stripe subscription tied to the athlete's Strava id.
// Checkout is a Stripe Payment Link (no code); Stripe's webhook tells us who paid.
import { createHmac, timingSafeEqual } from 'node:crypto';

const ACTIVE = ['active', 'trialing', 'past_due'];

// Stripe-Signature: t=timestamp,v1=hex(hmac_sha256(secret, `${t}.${payload}`))
export function verifyStripe(payload, header, secret, now = Date.now()) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=')).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = header.split(',').filter((kv) => kv.trim().startsWith('v1=')).map((kv) => kv.trim().slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(now / 1000 - t) > 600 || !sigs.length) return false;
  const want = Buffer.from(createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex'));
  return sigs.some((s) => { const got = Buffer.from(s); return got.length === want.length && timingSafeEqual(got, want); });
}

export async function athleteId(token, fetchImpl = fetch) {
  if (!token) return null;
  try { const r = await fetchImpl('https://www.strava.com/api/v3/athlete', { headers: { authorization: `Bearer ${token}` } }); return r.ok ? (await r.json()).id : null; }
  catch { return null; }
}

// App asks: is this athlete Pro?
export async function handleStatus(req, store, fetchImpl = fetch) {
  if (req.method !== 'POST') return [{ error: 'Use POST' }, 405];
  let body; try { body = await req.json(); } catch { return [{ error: 'Invalid JSON' }, 400]; }
  const id = await athleteId(body.access_token, fetchImpl);
  if (!id) return [{ error: 'Connect Strava first.' }, 401];
  const d = await store.get(`pro/${id}`, { type: 'json' });
  return [{ pro: !!(d && d.active), since: d ? d.since : null }, 200];
}

// Stripe tells us: someone paid, renewed or cancelled.
export async function handleWebhook(payload, signature, secret, store) {
  if (!verifyStripe(payload, signature, secret)) return [{ error: 'Bad signature' }, 400];
  const ev = JSON.parse(payload), o = ev.data && ev.data.object || {};
  if (ev.type === 'checkout.session.completed') {
    const id = String(o.client_reference_id || '').replace(/\D/g, '');
    if (!id) return [{ ok: true, note: 'no athlete id' }, 200];
    await store.setJSON(`pro/${id}`, { active: true, since: new Date().toISOString(), customer: o.customer || null, subscription: o.subscription || null });
    if (o.subscription) await store.setJSON(`sub/${o.subscription}`, { athlete: id });
  } else if (ev.type === 'customer.subscription.updated' || ev.type === 'customer.subscription.deleted') {
    const link = await store.get(`sub/${o.id}`, { type: 'json' });
    if (link) {
      const prev = (await store.get(`pro/${link.athlete}`, { type: 'json' })) || {};
      await store.setJSON(`pro/${link.athlete}`, { ...prev, active: ev.type === 'customer.subscription.updated' && ACTIVE.includes(o.status) });
    }
  }
  return [{ ok: true }, 200];
}
