import { getAnthropic } from './anthropic.js';

const SLACK_MCP_URL = 'https://mcp.slack.com/mcp';

const SYSTEM_PROMPT = `You help a teammate just looped into a customer thread by finding ONE or TWO prior related Slack discussions — fast.

Use the connected "slack" MCP tools to run AT MOST two focused searches (e.g. the customer/account name, or the main error/keyword from the thread). Do NOT explore exhaustively — prioritize speed over completeness.

Return ONLY a JSON object — no markdown, no commentary:
{
  "found": true | false,
  "summary": "1-2 sentences on the most relevant prior thread(s), what was concluded, and who handled it. Reference channels as <#CHANNEL_ID> when known. Empty string if nothing relevant."
}
Only report conversations you actually found via search. Never invent threads, people, or outcomes.`;

/**
 * Search the Slack workspace (via the Slack MCP server) for prior conversations
 * related to a thread. Returns null when not configured (no SLACK_USER_TOKEN),
 * on failure, or when nothing relevant is found.
 * @param {string} teamId
 * @param {string} transcript
 * @param {string | undefined} [userToken] - the installing team's Slack user token
 * @returns {Promise<{ summary: string } | null>}
 */
export async function searchRelatedHistory(teamId, transcript, userToken) {
  const token = userToken;
  if (!token) return null;

  // Streamed so the long server-side MCP search loop keeps the connection alive
  // instead of hitting a single-request timeout.
  const stream = getAnthropic(teamId).beta.messages.stream(
    {
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      betas: ['mcp-client-2025-11-20'],
      output_config: { effort: 'low' },
      mcp_servers: [{ type: 'url', name: 'slack', url: SLACK_MCP_URL, authorization_token: token }],
      tools: [{ type: 'mcp_toolset', mcp_server_name: 'slack' }],
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: `Current customer thread:\n\n${transcript}\n\nFind related prior conversations.` },
      ],
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
  if (!parsed.found || !parsed.summary) return null;
  return { summary: String(parsed.summary) };
}
