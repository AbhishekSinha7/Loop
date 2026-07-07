// One-time interactive login to your Salesforce hosted MCP server's External
// Client App. Runs the OAuth 2.0 Authorization Code + PKCE flow and prints a
// refresh token to put in .env (the access token is then auto-refreshed at
// runtime by salesforce/sf-token.js).
//
// Prereqs in .env: SALESFORCE_CLIENT_ID (External Client App consumer key),
// and SALESFORCE_LOGIN_URL if you use a My Domain / sandbox.
// The External Client App's callback URL must be: http://localhost:1717/oauth/callback
//
//   node scripts/sf-mcp-login.js
import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';

let LOGIN = (process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').trim().replace(/\/+$/, '');
if (!/^https?:\/\//i.test(LOGIN)) LOGIN = 'https://' + LOGIN;
const CLIENT_ID = process.env.SALESFORCE_CLIENT_ID;
const CLIENT_SECRET = process.env.SALESFORCE_CLIENT_SECRET; // optional (public PKCE client needs none)
const REDIRECT = 'http://localhost:1717/oauth/callback';

if (!CLIENT_ID) {
  console.error('Set SALESFORCE_CLIENT_ID in .env first (your External Client App consumer key).');
  process.exit(1);
}

const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

const authUrl =
  `${LOGIN}/services/oauth2/authorize?response_type=code` +
  `&client_id=${encodeURIComponent(CLIENT_ID)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&scope=${encodeURIComponent('mcp_api refresh_token')}` +
  `&code_challenge=${challenge}&code_challenge_method=S256`;

console.log('\n1) Open this URL in your browser and approve access:\n');
console.log(`${authUrl}\n`);
console.log('Waiting for the redirect on http://localhost:1717 ...\n');

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.url.startsWith('/oauth/callback')) {
    res.writeHead(404);
    res.end();
    return;
  }
  const code = new URL(req.url, REDIRECT).searchParams.get('code');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<p>Got it — you can close this tab and return to the terminal.</p>');
  server.close();

  if (!code) {
    console.error('No authorization code received.');
    process.exit(1);
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
  });
  if (CLIENT_SECRET) body.set('client_secret', CLIENT_SECRET);

  const tok = await fetch(`${LOGIN}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await tok.json();
  if (!tok.ok) {
    console.error('Token exchange failed:', json);
    process.exit(1);
  }

  console.log('✅ Success. Add this to your .env:\n');
  console.log(`SALESFORCE_REFRESH_TOKEN=${json.refresh_token || '(none — confirm the refresh_token scope is enabled)'}`);
  console.log(`\n# instance_url returned: ${json.instance_url}`);
  console.log('# The access token auto-refreshes at runtime — no need to paste it.');
  process.exit(0);
});

server.listen(1717);
