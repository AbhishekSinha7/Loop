import { recentThreads, handoffsForThread } from '../../db/index.js';

/**
 * @param {number} ts
 * @returns {string}
 */
function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Render recent customer threads + their handoffs as Block Kit.
 * @param {string} teamId
 * @param {any[]} threads
 * @returns {any[]}
 */
function buildHistoryBlocks(teamId, threads) {
  if (threads.length === 0) {
    return [{ type: 'section', text: { type: 'mrkdwn', text: '_No customer threads recorded yet._' } }];
  }

  /** @type {any[]} */
  const blocks = [{ type: 'header', text: { type: 'plain_text', text: '🗂️ Customer history', emoji: true } }];

  for (const t of threads) {
    const handoffs = handoffsForThread(teamId, t.id);
    const people = [...new Set(handoffs.map((h) => h.toId).filter(Boolean))].map((id) => `<@${id}>`);
    const count = handoffs.length;
    const bits = [`*<#${t.channelId}>*`, `🔁 ${count} handoff${count === 1 ? '' : 's'}`, `updated ${timeAgo(t.updatedAt)}`];
    let text = bits.join(' · ');
    if (people.length) text += `\n↳ looped in: ${people.join(', ')}`;
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text } });
  }

  return blocks;
}

/**
 * /customer-history — show recent customer threads + handoffs from the local store.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackCommandMiddlewareArgs} args
 * @returns {Promise<void>}
 */
export async function handleCustomerHistory({ ack, context, respond, logger }) {
  await ack();

  try {
    const teamId = /** @type {string} */ (context.teamId);
    const threads = recentThreads(teamId, 10);
    await respond({ response_type: 'ephemeral', text: 'Customer history', blocks: buildHistoryBlocks(teamId, threads) });
  } catch (e) {
    logger.error(`Failed to build customer history: ${e}`);
  }
}
