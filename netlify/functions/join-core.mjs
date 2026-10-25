// Team invite page (/t/CODE): a tiny page whose link preview names the team,
// then forwards to the app with the team code.
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export async function joinPage(req, store) {
  const url = new URL(req.url), code = (url.pathname.split('/').filter(Boolean)[1] || '').toUpperCase();
  if (!/^[A-Z0-9-]{4,20}$/.test(code)) return new Response(null, { status: 302, headers: { location: '/' } });
  let name = '';
  try { const meta = await store.get(`meta/${code}`, { type: 'json' }); name = (meta && meta.name) || ''; } catch {}
  name = name || (url.searchParams.get('tn') || '').trim().slice(0, 30);
  const team = name || code, to = `/?team=${encodeURIComponent(code)}${name ? '&tn=' + encodeURIComponent(name) : ''}&src=invite`;
  const title = `Join ${team} on LANZA`, desc = 'Log your throwing practice with your team, compare LANZA Scores and post to Strava.';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="LANZA"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${esc(url.origin)}/icon-512.png"><meta property="og:url" content="${esc(url.origin + url.pathname)}">
<meta name="twitter:card" content="summary"><meta http-equiv="refresh" content="0;url=${esc(to)}">
<style>body{background:#000;color:#fff;font:16px -apple-system,system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0}a{color:#fff}</style>
</head><body><a href="${esc(to)}">${esc(title)}</a><script>location.replace(${JSON.stringify(to)})</script></body></html>`;
  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } });
}
