import { getAnthropic } from './anthropic.js';

const SYSTEM_PROMPT = `You are briefing a colleague who was just pulled into a customer \
support conversation in Slack, so they can step in without asking "can you catch me up?".

From the thread transcript, return ONLY a JSON object — no markdown, no commentary — with \
exactly these fields:
{
  "issue": "one sentence on what the customer's problem is",
  "tried": "what's already been attempted or established, or 'Nothing yet'",
  "pending": "the open question or what's needed next, or 'Unclear'",
  "topic": "a 1-3 word category for routing, e.g. 'billing', 'SSO login', 'API limits'"
}

Keep each field to one or two sentences. Use participants' names where helpful. Never \
invent details that aren't in the thread.`;

/**
 * Summarize a thread transcript into a structured brief.
 * Throws on failure (e.g. no key); caller should fall back to the raw template.
 * @param {string} teamId
 * @param {string} transcript
 * @returns {Promise<{ issue: string, tried: string, pending: string, topic: string | null }>}
 */
export async function synthesizeBrief(teamId, transcript) {
  const resp = await (await getAnthropic(teamId)).messages.create(
    {
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    },
    { timeout: 20000, maxRetries: 0 }, // synthesis generates more; give it more room
  );

  let out = '';
  for (const block of resp.content) {
    if (block.type === 'text') out += block.text;
  }

  const start = out.indexOf('{');
  const end = out.lastIndexOf('}');
  const parsed = JSON.parse(start >= 0 && end > start ? out.slice(start, end + 1) : out);
  return {
    issue: parsed.issue || '—',
    tried: parsed.tried || '—',
    pending: parsed.pending || '—',
    topic: parsed.topic || null,
  };
}