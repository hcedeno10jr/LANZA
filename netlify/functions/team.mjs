// Team board: stores each shared session in Netlify Blobs (free, no extra account).
import { getStore } from '@netlify/blobs';
import { json } from './_shared.mjs';
import { handle } from './team-core.mjs';

export default async (req) => {
  const store = getStore({ name: 'kinetic-teams', consistency: 'strong' });
  const [data, status] = await handle(req, store);
  return json(data, status);
};
