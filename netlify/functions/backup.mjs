// History backup (see backup-core.mjs). Stored in Netlify Blobs next to the team board.
import { getStore } from '@netlify/blobs';
import { json } from './_shared.mjs';
import { handle } from './backup-core.mjs';

export default async (req) => {
  const store = getStore({ name: 'lanza-backups', consistency: 'strong' });
  const [data, status] = await handle(req, store, fetch, getStore({ name: 'lanza-accounts', consistency: 'strong' }));
  return json(data, status);
};
