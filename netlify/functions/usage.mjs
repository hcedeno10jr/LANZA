// Usage counts (see usage-core.mjs). The owner reads them at /usage.html, or from the Claude
// dashboard (another origin, hence CORS), with USAGE_KEY.
import { getStore } from '@netlify/blobs';
import { env } from './_shared.mjs';
import { handle } from './usage-core.mjs';

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type' };

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const [data, status] = await handle(req, getStore({ name: 'lanza-usage' }), env('USAGE_KEY'), {
    accounts: getStore({ name: 'lanza-accounts', consistency: 'strong' }),
    teams: getStore({ name: 'kinetic-teams', consistency: 'strong' })
  });
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...CORS } });
};
