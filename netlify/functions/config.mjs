// Public settings the app reads on start. Everything comes from Netlify environment variables,
// so turning features on never needs a code change.
import { json, env } from './_shared.mjs';

export default async () =>
  json({
    stravaClientId: env('STRAVA_CLIENT_ID') || null,
    googleClientId: env('GOOGLE_CLIENT_ID') || null,
    adsEnabled: env('ADS_ENABLED') === 'true',
    adUnitPath: env('AD_UNIT_PATH') || null, // Google Ad Manager rewarded ad unit, e.g. /1234567/lanza_rewarded
    adsTest: env('ADS_TEST') === 'true', // Google's sample rewarded ad, to check the flow before the real unit is approved
    freeSessionsPerWeek: Number(env('FREE_SESSIONS_PER_WEEK')) || 1,
    // LANZA Pro: a Stripe Payment Link for the subscription, the customer portal login link, and the price shown
    proUrl: env('PRO_PAYMENT_LINK') || null,
    proPortal: env('PRO_PORTAL_URL') || null,
    proPrice: env('PRO_PRICE_LABEL') || null
  });
