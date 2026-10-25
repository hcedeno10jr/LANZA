// LANZA account sign-in (see account-core.mjs). Google's client secret stays in Netlify env vars.
import { getStore } from '@netlify/blobs';
import { json, env } from './_shared.mjs';
import { handle } from './account-core.mjs';

export default async (req) => {
  const store = getStore({ name: 'lanza-accounts', consistency: 'strong' });
  const handoffs = getStore({ name: 'lanza-oauth', consistency: 'strong' });
  const [data, status] = await handle(req, store, { env, handoffs });
  return json(data, status);
};
