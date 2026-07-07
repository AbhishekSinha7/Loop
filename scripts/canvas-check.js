// Test canvas create in isolation — drops a sample dossier canvas in a channel.
//   node scripts/canvas-check.js <CHANNEL_ID>   (a channel you're a member of)
import 'dotenv/config';
import { syncThreadCanvas } from '../slack/canvas.js';

const channelId = process.argv[2];
if (!process.env.SLACK_USER_TOKEN) {
  console.error('Set SLACK_USER_TOKEN in .env first.');
  process.exit(1);
}
if (!channelId) {
  console.error('Usage: node scripts/canvas-check.js <CHANNEL_ID>');
  process.exit(1);
}

const r = await syncThreadCanvas({
  channelId,
  summary: { issue: 'Customer cannot log in (403 on SSO).', tried: 'Checked SAML; reset session.', pending: 'Needs the auth team.' },
  caseContext: { caseNumber: '00012345', accountName: 'Acme', accountTier: 'Enterprise', status: 'Escalated', priorCases: 4 },
  related: { summary: 'Same SSO error came up last month, fixed by rotating the cert.' },
  handoffCount: 2,
  loopedIn: ['U000EXAMPLE'],
  userToken: process.env.SLACK_USER_TOKEN,
});

console.log(
  r
    ? `✅ canvas ${r.canvasId}\n   link: ${r.link || '(link not constructed — open it from the channel canvas tab)'}`
    : '(canvas not created — check SLACK_USER_TOKEN, the canvases:write scope, and that you are in the channel)',
);
