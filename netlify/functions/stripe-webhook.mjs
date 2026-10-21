// Stripe webhook endpoint: https://<your-site>/.netlify/functions/stripe-webhook
// Events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted.
import { getStore } from '@netlify/blobs';
import { json, env } from './_shared.mjs';
import { handleWebhook } from './pro-core.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const payload = await req.text();
  const [data, status] = await handleWebhook(payload, req.headers.get('stripe-signature'), env('STRIPE_WEBHOOK_SECRET'), getStore({ name: 'lanza-pro', consistency: 'strong' }));
  return json(data, status);
};
