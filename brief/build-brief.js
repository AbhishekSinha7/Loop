/**
 * Render the handoff brief. If `summary` (from the LLM) is present, show the
 * structured brief; otherwise fall back to a raw dump of recent messages.
 *
 * @param {{ channelId: string, messages: Array<{user?: string, text?: string}>, nameOf: (userId: string) => string, handoffCount?: number, summary?: {issue: string, tried: string, pending: string} | null, suggestion?: { expertId: string, topic: string, channelId: string, rootTs: string } | null, caseContext?: { caseNumber: string, status: string, accountName: string, accountTier: string, priorCases: number, recentActivity?: string } | null, related?: { summary: string } | null, canvasLink?: string | null }} input
 * @returns {{ text: string, blocks: any[] }}
 */
export function buildBrief({ channelId, messages, nameOf, handoffCount = 1, summary = null, suggestion = null, caseContext = null, related = null, canvasLink = null }) {
  const channelRef = `<#${channelId}>`;

  let body;
  if (summary) {
    body = [
      { type: 'section', text: { type: 'mrkdwn', text: `*Issue*\n${summary.issue}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Tried so far*\n${summary.tried}` } },
      { type: 'section', text: { type: 'mrkdwn', text: `*Open question*\n${summary.pending}` } },
    ];
  } else {
    const recent = messages.slice(-6);
    const lines = recent.map((m) => {
      const who = m.user ? nameOf(m.user) : 'someone';
      const t = (m.text || '').replace(/\s+/g, ' ').trim() || '_(no text)_';
      return `*${who}:* ${t}`;
    });
    body = [{ type: 'section', text: { type: 'mrkdwn', text: lines.length ? lines.join('\n') : '_No messages yet._' } }];
  }

  const ctx = [`🧵 ${messages.length} message(s)`];
  if (handoffCount > 1) ctx.push(`🔁 handed off ${handoffCount}×`);

  /** @type {any[]} */
  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: "📋 You’ve been looped in", emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `Here’s what you need to know about ${channelRef}:` } },
    ...body,
  ];

  if (caseContext) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🧾 *Salesforce* — Case ${caseContext.caseNumber} · ${caseContext.accountName} (${caseContext.accountTier})\nStatus: *${caseContext.status}* · ${caseContext.priorCases} prior case(s)${caseContext.recentActivity ? `\n_Latest:_ ${caseContext.recentActivity}` : ''}`,
      },
    });
  }

  if (related) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `🔎 *Seen before*\n${related.summary}` } });
  }

  if (suggestion) {
    blocks.push(
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `💡 <@${suggestion.expertId}> has handled more *${suggestion.topic}* handoffs — want me to loop them in?` },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Loop them in', emoji: true },
            action_id: 'loop_in_expert',
            value: JSON.stringify(suggestion),
          },
        ],
      },
    );
  }

  if (canvasLink) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `📄 <${canvasLink}|Open the live customer dossier>` } });
  }

  // Let the looped-in person ask Loop to draft the next customer reply.
  blocks.push({
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '✍️ Draft a reply', emoji: true },
        action_id: 'draft_reply',
      },
    ],
  });

  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: ctx.join(' · ') }] });

  return { text: `You’ve been looped into a conversation in ${channelRef}.`, blocks };
}