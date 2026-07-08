import { getAnthropic } from './anthropic.js';

const SYSTEM_PROMPT = `You help a customer-support agent reply to a customer in a Slack thread.

Write a concise, warm, professional reply the agent can send as-is or lightly edit. Ground it ONLY \
in the context provided — never invent facts, fixes, dates, refunds, or commitments that aren't \
there. If a key detail is missing to resolve the issue, ask the customer one clear question instead \
of guessing.

Rules:
- 2-5 sentences. No salutation placeholders like "[Name]" unless a name is given.
- Acknowledge the issue, then give the next step or the answer.
- Plain text the agent can paste. No markdown headers, no quotes around the whole thing.
Return ONLY the reply text — no preamble, no commentary.`;

/**
 * Draft a customer-ready reply from the stored brief context.
 * Throws if the model is unavailable; callers should catch.
 * @param {string} teamId
 * @param {{ transcript?: string, summary?: { issue: string, tried: string, pending: string } | null, caseContext?: { caseNumber: string, status: string, accountName: string, accountTier: string, priorCases: number, recentActivity?: string } | null, related?: { summary: string } | null }} ctx
 * @returns {Promise<string>}
 */
export async function draftReply(teamId, ctx) {
  const parts = [];
  if (ctx.summary) {
    parts.push(`Issue: ${ctx.summary.issue}`, `Tried so far: ${ctx.summary.tried}`, `Open question: ${ctx.summary.pending}`);
  }
  if (ctx.caseContext) {
    const c = ctx.caseContext;
    parts.push(`Salesforce: Case ${c.caseNumber} — ${c.accountName} (${c.accountTier}), status ${c.status}.${c.recentActivity ? ` Latest: ${c.recentActivity}` : ''}`);
  }
  if (ctx.related?.summary) parts.push(`Prior related context: ${ctx.related.summary}`);
  if (ctx.transcript) parts.push('', 'Thread so far:', ctx.transcript);

  const resp = await (await getAnthropic(teamId)).messages.create(
    {
      model: 'claude-opus-4-8',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Draft the agent's next reply to the customer.\n\n${parts.join('\n')}` }],
    },
    { timeout: 20000, maxRetries: 0 },
  );

  let out = '';
  for (const block of resp.content) {
    if (block.type === 'text') out += block.text;
  }
  return out.trim();
}
