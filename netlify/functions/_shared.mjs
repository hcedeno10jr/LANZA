// Small helpers shared by the Kinetic Metrics functions.
export const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });

export const env = (k) => (process.env[k] || '').trim();
