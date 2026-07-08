import { getAnthropic } from './anthropic.js';

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
 * @param {string} teamId
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function classifyHandoff(teamId, text) {
  const resp = await getAnthropic(teamId).messages.create(
    {
      model: 'claude-opus-4-8',
      max_tokens: 16, // one word: YES / NO
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Classify this message:\n\n${text}` }],
    },
    { timeout: 8000, maxRetries: 0 }, // single bounded attempt; throws on timeout → caller falls back
  );

  let out = '';
  for (const block of resp.content) {
    if (block.type === 'text') out += block.text;
  }
  return out.trim().toLowerCase().startsWith('yes');
}