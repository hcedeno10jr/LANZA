// LANZA Pro status for the app (see pro-core.mjs).
import { getStore } from '@netlify/blobs';
import { json } from './_shared.mjs';
import { handleStatus } from './pro-core.mjs';

export default async (req) => {
  const [data, status] = await handleStatus(req, getStore({ name: 'lanza-pro', consistency: 'strong' }));
  return json(data, status);
};
