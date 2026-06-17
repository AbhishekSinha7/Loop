/**
 * Build a "you've been looped in" brief from a thread's messages.
 * KEYLESS v1: just templates the raw thread. Later, swap the body for a Claude SDK call.
 * @param {{ channelId: string, messages: Array<{user?: string, text?: string}>, nameOf: (userId: string) => string, handoffCount?: number }} input
 * @returns {{ text: string, blocks: any[] }}
 */
export function buildBrief({ channelId, messages, nameOf, handoffCount = 1 }) {
  const channelRef = `<#${channelId}>`;
  const recent = messages.slice(-6);

  const lines = recent.map((m) => {
    const who = m.user ? nameOf(m.user) : 'someone';
    const body = (m.text || '').replace(/\s+/g, ' ').trim() || '_(no text)_';
    return `*${who}:* ${body}`;
  });

  const summary = lines.length ? lines.join('\n') : '_No messages in this thread yet._';
  const last = recent[recent.length - 1];
  const latest = last?.text ? last.text.replace(/\s+/g, ' ').trim() : '—';

  const ctx = [`🧵 ${messages.length} message(s)`];
  if (handoffCount > 1) ctx.push(`🔁 handed off ${handoffCount}×`);
  ctx.push(`latest: “${truncate(latest, 140)}”`);

  const blocks = [
    { type: 'header', text: { type: 'plain_text', text: "📋 You’ve been looped in", emoji: true } },
    { type: 'section', text: { type: 'mrkdwn', text: `Here’s what’s happening in ${channelRef} so far:` } },
    { type: 'section', text: { type: 'mrkdwn', text: summary } },
    { type: 'context', elements: [{ type: 'mrkdwn', text: ctx.join(' · ') }] },
  ];

  return { text: `You’ve been looped into a conversation in ${channelRef}.`, blocks };
}

function truncate(s, n) {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}