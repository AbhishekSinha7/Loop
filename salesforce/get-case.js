import { upsertCase, getCase, getSfConnection } from '../db/index.js';
import { getAnthropic } from '../agent/anthropic.js';
import { getAccessToken } from './sf-token.js';

/**
 * Pull a Salesforce case reference out of free text. Matches "Case 00012345",
 * "case #12345", "SF-12345", or a bare Salesforce-style 8-digit case number.
 * @param {string} text
 * @returns {string | null}
 */
export function parseCaseRef(text) {
  const t = text || '';
  const m =
    t.match(/\bcase\s*#?\s*(\d{4,10})\b/i) ||
    t.match(/\bSF[-\s]?(\d{4,10})\b/i) ||
    t.match(/\b(00\d{6})\b/);
  return m ? m[1] : null;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // refresh live case status every 5 min

const SYSTEM_PROMPT = `You look up a Salesforce case using the connected "salesforce" MCP tools and brief a colleague who was just pulled into the conversation.

Find the case by its case number. Also pull its MOST RECENT activity — the case comments or Chatter/feed posts, and any open tasks/events — but keep it brief; do NOT pull the full history.

Return ONLY a JSON object — no markdown, no commentary — with exactly these fields:
{
  "caseNumber": "the case number",
  "status": "the case status",
  "accountName": "the related account name, or 'Unknown'",
  "accountTier": "the account tier or type (e.g. Enterprise, Standard), or 'Unknown'",
  "priorCases": <number of other cases for that account, or 0>,
  "recentActivity": "1-2 sentences on the latest meaningful update — who did or said what and when, plus any open follow-up. Empty string if none."
}
If the case cannot be found, return {"notFound": true}.`;

/** Named fixtures for the mock fallback. @type {Record<string, any>} */
const FIXTURES = {
  '00012345': {
    accountName: 'Acme Corp',
    accountTier: 'Enterprise',
    status: 'Escalated',
    priorCases: 4,
    recentActivity: 'Customer replied 1h ago that the SSO error persists after the cert rotation; escalation owner paged.',
  },
  '00067890': {
    accountName: 'Globex',
    accountTier: 'Standard',
    status: 'Open',
    priorCases: 1,
    recentActivity: 'Agent left an internal note yesterday; awaiting customer confirmation.',
  },
};
const TIERS = ['Standard', 'Premier', 'Enterprise'];
const STATUSES = ['New', 'Open', 'Working', 'Escalated'];

/**
 * Deterministic placeholder case used when no Salesforce MCP server is configured.
 * @param {string} teamId
 * @param {string} ref
 * @returns {Promise<any>}
 */
async function mockCase(teamId, ref) {
  const fixture = FIXTURES[ref];
  const n = [...ref].reduce((a, c) => a + c.charCodeAt(0), 0);
  const data = {
    caseNumber: ref,
    status: fixture?.status ?? STATUSES[n % STATUSES.length],
    accountName: fixture?.accountName ?? `Account ${ref.slice(-4)}`,
    accountTier: fixture?.accountTier ?? TIERS[n % TIERS.length],
    priorCases: fixture?.priorCases ?? n % 6,
    recentActivity: fixture?.recentActivity ?? 'Support requested logs from the customer ~2h ago; awaiting reply.',
    mock: true,
  };
  await upsertCase(teamId, ref, data);
  return data;
}

/**
 * Fetch Salesforce case context for a case reference.
 *
 * Live path: when SALESFORCE_MCP_URL is set, Claude calls the hosted Salesforce
 * MCP server (via the Anthropic MCP connector) and returns the case plus its most
 * recent activity. Otherwise returns deterministic mock data so the demo works.
 *
 * Throws on a live-lookup failure (network/timeout); callers catch and proceed
 * without case context.
 *
 * @param {string} teamId
 * @param {string} ref - case number / reference parsed from the thread
 * @returns {Promise<{ caseNumber: string, status: string, accountName: string, accountTier: string, priorCases: number, recentActivity: string, mock: boolean } | null>}
 */
export async function getSalesforceCase(teamId, ref) {
  if (!ref) return null;

  const conn = await getSfConnection(teamId);
  const url = conn?.mcpUrl || process.env.SALESFORCE_MCP_URL;

  // Serve from cache when fresh — but never let a stale mock shadow a live lookup.
  const cached = await getCase(teamId, ref);
  if (cached && Date.now() - (cached.updatedAt || 0) < CACHE_TTL_MS && !(url && cached.mock)) {
    return cached;
  }

  if (!url) return await mockCase(teamId, ref);

  // Fresh OAuth access token for the hosted MCP server (auto-refreshed).
  const token = await getAccessToken(teamId);

  // --- Live Salesforce via the hosted MCP server (Anthropic MCP connector) ---
  // Streamed so the multi-tool fetch (case + recent activity) keeps the
  // connection alive instead of hitting a single-request timeout.
  const stream = (await getAnthropic(teamId)).beta.messages.stream(
    {
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      betas: ['mcp-client-2025-11-20'],
      output_config: { effort: 'low' },
      mcp_servers: [{ type: 'url', name: 'salesforce', url, authorization_token: token || undefined }],
      tools: [{ type: 'mcp_toolset', mcp_server_name: 'salesforce' }],
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Look up Salesforce case ${ref}, including its latest activity.` }],
    },
    { timeout: 60000, maxRetries: 0 },
  );

  const resp = await stream.finalMessage();

  let out = '';
  for (const block of resp.content) {
    if (block.type === 'text') out += block.text;
  }

  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  if (start < 0 || end <= start) return null;

  let parsed;
  try {
    parsed = JSON.parse(out.slice(start, end + 1));
  } catch {
    return null;
  }
  if (parsed.notFound) return null;

  const data = {
    caseNumber: parsed.caseNumber || ref,
    status: parsed.status || 'Unknown',
    accountName: parsed.accountName || 'Unknown',
    accountTier: parsed.accountTier || 'Unknown',
    priorCases: Number(parsed.priorCases) || 0,
    recentActivity: parsed.recentActivity || '',
    mock: false,
  };
  await upsertCase(teamId, ref, data);
  return data;
}
