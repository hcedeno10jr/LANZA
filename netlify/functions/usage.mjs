// Usage counts (see usage-core.mjs). The owner reads them at /usage.html with USAGE_KEY.
import { getStore } from '@netlify/blobs';
import { json, env } from './_shared.mjs';
import { handle } from './usage-core.mjs';

export default async (req) => {
  const [data, status] = await handle(req, getStore({ name: 'lanza-usage' }), env('USAGE_KEY'));
  return json(data, status);
};
