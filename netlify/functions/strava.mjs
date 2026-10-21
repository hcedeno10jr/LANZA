// Strava OAuth token exchange / refresh / deauthorize, activity upload and update (rename / new description).
// The client secret never leaves this function.
import { json, env } from './_shared.mjs';

const TOKEN_URL = 'https://www.strava.com/oauth/token';
const ACTIVITY_URL = 'https://www.strava.com/api/v3/activities';

const pickAthlete = (a) => a && { id: a.id, firstname: a.firstname, lastname: a.lastname, profile: a.profile_medium || a.profile };

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Use POST' }, 405);
  const id = env('STRAVA_CLIENT_ID'), secret = env('STRAVA_CLIENT_SECRET');
  if (!id || !secret) return json({ error: 'Strava is not set up on this site yet.' }, 503);

  let body;
  try { body = await req.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
  const { action } = body;

  if (action === 'exchange' || action === 'refresh') {
    const params = new URLSearchParams({ client_id: id, client_secret: secret });
    if (action === 'exchange') { params.set('grant_type', 'authorization_code'); params.set('code', String(body.code || '')); }
    else { params.set('grant_type', 'refresh_token'); params.set('refresh_token', String(body.refresh_token || '')); }
    const r = await fetch(TOKEN_URL, { method: 'POST', body: params });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: d.message || 'Strava rejected the sign-in.' }, r.status);
    return json({ access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, athlete: pickAthlete(d.athlete) });
  }

  if (action === 'upload') {
    const a = body.activity || {};
    const params = new URLSearchParams({
      name: String(a.name || 'Throwing practice').slice(0, 120),
      sport_type: 'Workout',
      start_date_local: String(a.start_date_local || new Date().toISOString()),
      elapsed_time: String(Math.max(60, Math.round(Number(a.elapsed_time) || 60))),
      description: String(a.description || '').slice(0, 2000)
    });
    const r = await fetch(ACTIVITY_URL, { method: 'POST', headers: { authorization: `Bearer ${body.access_token}` }, body: params });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      const scope = (d.errors || []).some((e) => /activity:write|permission/i.test(`${e.field} ${e.code}`));
      return json({ error: scope ? 'Strava needs permission to upload activities. Connect again and keep "Upload your activities" ticked.' : d.message || 'Strava upload failed.', needsScope: scope }, r.status);
    }
    return json({ id: d.id });
  }

  if (action === 'update') {
    const a = body.activity || {}, aid = String(body.id || '');
    if (!/^\d{1,20}$/.test(aid)) return json({ error: 'Bad activity id' }, 400);
    const params = new URLSearchParams();
    if (a.name) params.set('name', String(a.name).slice(0, 120));
    if (a.description != null) params.set('description', String(a.description).slice(0, 2000));
    const r = await fetch(`${ACTIVITY_URL}/${aid}`, { method: 'PUT', headers: { authorization: `Bearer ${body.access_token}` }, body: params });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return json({ error: d.message || 'Strava update failed.' }, r.status);
    return json({ id: d.id });
  }

  // Disconnect: revokes LANZA's access on Strava's side too.
  if (action === 'deauthorize') {
    const r = await fetch('https://www.strava.com/oauth/deauthorize', { method: 'POST', body: new URLSearchParams({ access_token: String(body.access_token || '') }) });
    return json({ ok: r.ok }, r.ok ? 200 : r.status);
  }

  return json({ error: 'Unknown action' }, 400);
};
