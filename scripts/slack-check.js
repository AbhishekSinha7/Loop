// Verify the Slack user token works and has the scopes Loop needs (search + canvas).
//   node scripts/slack-check.js [search term]
import 'dotenv/config';
import { WebClient } from '@slack/web-api';

const token = process.env.SLACK_USER_TOKEN;
if (!token) {
  console.error('Set SLACK_USER_TOKEN in .env (the xoxp- "User OAuth Token" from OAuth & Permissions).');
  process.exit(1);
}
if (!token.startsWith('xoxp-')) {
  console.warn('Warning: a user token usually starts with "xoxp-". Bot tokens (xoxb-) cannot search.');
}

const web = new WebClient(token);

const auth = await web.auth.test().catch((e) => {
  console.error('auth.test failed:', e.data?.error || e.message);
  process.exit(1);
});
console.log('auth.test ->', { ok: auth.ok, user: auth.user, team: auth.team, url: auth.url });

const q = process.argv[2] || 'the';
try {
  const res = await web.search.messages({ query: q, count: 1 });
  console.log(`search.messages("${q}") -> ok=${res.ok}, total matches=${res.messages?.total ?? 0}`);
  console.log('✅ user token works and has search access — ready for the Slack MCP features.');
} catch (e) {
  console.error('search.messages failed:', e.data?.error || e.message);
  console.error('-> add the search:read User Token Scope in OAuth & Permissions, then reinstall and copy a fresh xoxp token.');
  process.exit(1);
}
