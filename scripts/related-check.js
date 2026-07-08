// Test the "seen this before" Slack workspace search in isolation.
//   node scripts/related-check.js ["pasted transcript"]
import 'dotenv/config';
import { searchRelatedHistory } from '../agent/related-history.js';

const transcript =
  process.argv[2] ||
  'alice: Customer cannot log in — getting a 403 on SSO.\nbob: Checked their SAML config, looks fine. Reset their session, still failing.';

if (!process.env.SLACK_USER_TOKEN) {
  console.error('Set SLACK_USER_TOKEN in .env first (see scripts/slack-check.js).');
  process.exit(1);
}

console.log('Searching the workspace for related prior conversations ...\n');
try {
  const r = await searchRelatedHistory(process.env.LOOP_TEAM_ID, transcript, process.env.SLACK_USER_TOKEN);
  console.log(r ? `🔎 ${r.summary}` : '(nothing relevant found)');
} catch (e) {
  console.error('search failed:', e.message);
  process.exit(1);
}
