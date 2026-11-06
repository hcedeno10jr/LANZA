// /ads.txt: tells ad buyers which Google publisher account may sell ads on this site.
// Set ADS_PUBLISHER_ID (e.g. pub-1234567890123456, from AdSense or Ad Manager) in Netlify.
import { env } from './_shared.mjs';

export default async () => {
  const id = String(env('ADS_PUBLISHER_ID') || '').trim().replace(/^ca-/, '');
  if (!/^pub-\d{10,20}$/.test(id)) return new Response('', { status: 404 });
  return new Response(`google.com, ${id}, DIRECT, f08c47fec0942fa0\n`, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
};
export const config = { path: '/ads.txt' };
