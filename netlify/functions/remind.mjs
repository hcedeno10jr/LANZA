// /.netlify/functions/remind?d=YYYYMMDD&t=HHMM&w=1 : calendar file for the "Remind me" button.
// Kept under /.netlify/ so the service worker never caches it as the app page.
import { handle } from './remind-core.mjs';

export default async (req) => handle(req);
