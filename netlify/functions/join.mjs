// /t/CODE invite links: the preview in WhatsApp and iMessage shows the team's name.
import { getStore } from '@netlify/blobs';
import { joinPage } from './join-core.mjs';

export default async (req) => joinPage(req, getStore({ name: 'kinetic-teams', consistency: 'strong' }));
export const config = { path: '/t/:code' };
