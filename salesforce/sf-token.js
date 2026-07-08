// Mint/refresh a Salesforce access token for the hosted MCP server, per team.
//
// Resolution order:
//   1. SALESFORCE_MCP_TOKEN — a manually pasted access token (dev override).
//   2. The team's stored connection (db sf_connections) — auto-refreshed.
//   3. SALESFORCE_* env — single-tenant dev fallback.
//   4. null — caller falls back to mock / omits the MCP auth header.
import { getSfConnection } from '../db/index.js';

/**
 * @param {{ loginUrl?: string | null } | null} conn
 * @returns {string}
 */
function loginUrlFor(conn) {
  let u = (conn?.loginUrl || process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u;
}

/** Access-token cache keyed by team (or 'env' for the dev fallback). @type {Map<string, { token: string, exp: number }>} */
const cache = new Map();

/**
 * Return a valid bearer token for a team's hosted Salesforce MCP server, or null
 * if not configured. Throws if a refresh attempt fails.
 * @param {string} [teamId]
 * @returns {Promise<string | null>}
 */
export async function getAccessToken(teamId) {
  if (process.env.SALESFORCE_MCP_TOKEN) return process.env.SALESFORCE_MCP_TOKEN;

  const conn = teamId ? await getSfConnection(teamId) : null;
  const refreshToken = conn?.refreshToken || process.env.SALESFORCE_REFRESH_TOKEN;
  const clientId = conn?.clientId || process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = conn?.clientSecret || process.env.SALESFORCE_CLIENT_SECRET;
  if (!refreshToken || !clientId) return null;

  const cacheKey = teamId || 'env';
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.exp) return cached.token;

  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId });
  if (clientSecret) body.set('client_secret', clientSecret);

  const resp = await fetch(`${loginUrlFor(conn)}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) throw new Error(`Salesforce token refresh failed (${resp.status})`);

  const json = /** @type {any} */ (await resp.json());
  cache.set(cacheKey, { token: json.access_token, exp: Date.now() + 25 * 60 * 1000 });
  return json.access_token;
}
