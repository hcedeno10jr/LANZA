// "Remind me" calendar file: one practice event (optionally weekly) at the player's local time,
// with a 15-minute alert and a link that opens a ready session. Nothing is stored.
const clean = (s, n) => String(s || '').replace(/[\r\n]+/g, ' ').replace(/[\;,]/g, (c) => '\\' + c).slice(0, n);

export function ics(url) {
  const q = url.searchParams;
  const d = (q.get('d') || '').match(/^(\d{4})(\d{2})(\d{2})$/), t = (q.get('t') || '').match(/^([01]\d|2[0-3])([0-5]\d)$/);
  if (!d || !t) return null;
  const app = `${url.origin}/?src=remind&go=1`;
  const title = clean(q.get('title') || 'Throwing practice · LANZA', 80);
  const desc = clean(q.get('desc') || 'Throw your 20.', 200) + '\\n' + app;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//LANZA//Practice reminder//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${d[0]}${t[0]}-${Math.random().toString(36).slice(2, 10)}@lanza`, `DTSTAMP:${stamp}`,
    `DTSTART:${d[0]}T${t[1]}${t[2]}00`, 'DURATION:PT30M', ...(q.get('w') === '1' ? ['RRULE:FREQ=WEEKLY'] : []),
    `SUMMARY:${title}`, `DESCRIPTION:${desc}`, `URL:${app}`,
    'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR', ''
  ].join('\r\n');
}

export function handle(req) {
  const body = ics(new URL(req.url));
  if (!body) return new Response('Missing day or time', { status: 400 });
  return new Response(body, { headers: { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'attachment; filename="lanza-practice.ics"', 'cache-control': 'no-store' } });
}
