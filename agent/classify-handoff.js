import { query } from '@anthropic-ai/claude-agent-sdk';

const SYSTEM_PROMPT = `You classify a single Slack message.

Decide whether it HANDS OFF the conversation to a person mentioned in it — asking \
them to take over, own, handle, investigate, or look into something — as opposed to \
mentioning them for another reason (thanking them, cc/FYI, asking their opinion, or \
just referring to them).

Answer with exactly one word: YES or NO.`;

/**
 * Ask Claude whether a message is handing the thread to a mentioned user.
 * Throws if the model is unavailable (e.g. no ANTHROPIC_API_KEY); callers
 * should catch and fall back to a heuristic.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function classifyHandoff(text) {
  /** @type {import('@anthropic-ai/claude-agent-sdk').Options} */
  const options = {
    systemPrompt: SYSTEM_PROMPT,
    allowedTools: [],
    permissionMode: 'bypassPermissions',
  };

  let out = '';
  for await (const message of query({ prompt: `Classify this message:\n\n${text}`, options })) {
    if (message.type === 'assistant') {
      for (const block of message.message.content) {
        if (block.type === 'text') out += block.text;
      }
    }
  }
  return out.trim().toLowerCase().startsWith('yes');
}