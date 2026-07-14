// Per-org Salesforce OAuth (PKCE) connect flow. startConnect() builds the
// authorize URL + stashes the verifier; completeConnect() (called from the
// /salesforce/callback HTTP route) exchanges the code and stores the connection.
import crypto from 'node:crypto';
import { setSfConnection } from '../db/index.js';

const REDIRECT_PATH = '/salesforce/callback';

/** Pending OAuth flows keyed by state. @type {Map<string, any>} */
const pending = new Map();

function publicBase() {
  const raw = process.env.PUBLIC_URL || (process.env.SLACK_REDIRECT_URI ? new URL(process.env.SLACK_REDIRECT_URI).origin : '');
  return raw.replace(/\/+$/, '');
}

/** @returns {string} */
export function redirectUri() {
  return `${publicBase()}${REDIRECT_PATH}`;
}

/**
 * True when the operator has configured an absolute public callback URL (via
 * PUBLIC_URL or SLACK_REDIRECT_URI). Salesforce rejects a relative redirect_uri,
 * so the Connect flow checks this before sending an admin to Salesforce.
 * @returns {boolean}
 */
export function redirectConfigured() {
  return /^https:\/\/.+/i.test(redirectUri());
}

/**
 * @param {string | undefined} loginUrl
 * @returns {string}
 */
function normLogin(loginUrl) {
  let u = (loginUrl || 'https://login.salesforce.com').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

/**
 * Build the Salesforce authorize URL and stash the PKCE verifier + pending config.
 * @param {{ teamId: string, mcpUrl: string, loginUrl: string, clientId: string, clientSecret?: string }} input
 * @returns {{ url: string, state: string }}
 */
export function startConnect({ teamId, mcpUrl, loginUrl, clientId, clientSecret }) {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const state = crypto.randomBytes(16).toString('base64url');
  const login = normLogin(loginUrl);

  pending.set(state, { teamId, verifier, mcpUrl, loginUrl: login, clientId, clientSecret, at: Date.now() });
  for (const [k, val] of pending) if (Date.now() - val.at > 600000) pending.delete(k); // expire after 10 min

  const url =
    `${login}/services/oauth2/authorize?response_type=code` +
    `&client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri())}` +
    `&scope=${encodeURIComponent('mcp_api refresh_token')}` +
    `&code_challenge=${challenge}&code_challenge_method=S256&state=${state}`;
  return { url, state };
}

/**
 * Exchange an authorization code for a refresh token and store the team's connection.
 * @param {string} code
 * @param {string} state
 * @returns {Promise<{ teamId: string }>}
 */
export async function completeConnect(code, state) {
  const p = pending.get(state);
  if (!p) throw new Error('Unknown or expired connect state');
  pending.delete(state);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: p.clientId,
    redirect_uri: redirectUri(),
    code_verifier: p.verifier,
  });
  if (p.clientSecret) body.set('client_secret', p.clientSecret);

  const resp = await fetch(`${p.loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = /** @type {any} */ (await resp.json());
  if (!resp.ok || !json.refresh_token) throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);

  await setSfConnection(p.teamId, {
    mcpUrl: p.mcpUrl,
    loginUrl: p.loginUrl,
    clientId: p.clientId,
    clientSecret: p.clientSecret || null,
    refreshToken: json.refresh_token,
  });
  return { teamId: p.teamId };
}
