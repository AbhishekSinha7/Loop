import { draftReply } from '../../agent/draft-reply.js';
import { briefContextStore } from '../../thread-context/index.js';

const MAX_VALUE = 1800; // Slack button `value` max is 2000 chars; leave headroom for JSON.

/**
 * "✍️ Draft a reply" on a handoff brief → generate a customer-ready draft from the
 * stored brief context and show it in the DM with a "Post to thread" button.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockButtonAction>} args
 * @returns {Promise<void>}
 */
export async function handleDraftReply({ ack, body, client, context, logger }) {
  await ack();

  const dmChannel = body.channel?.id;
  if (!dmChannel) return;

  try {
    const teamId = /** @type {string} */ (context.teamId || body.team?.id);
    const ctx = briefContextStore.get(dmChannel);
    if (!ctx) {
      await client.chat.postMessage({ channel: dmChannel, text: "I no longer have this thread's context to draft from. Open the thread and try again." });
      return;
    }

    let draft;
    try {
      draft = await draftReply(teamId, ctx);
    } catch (e) {
      logger.warn(`Draft generation failed: ${e}`);
      await client.chat.postMessage({ channel: dmChannel, text: "I couldn't draft a reply just now — try again in a moment." });
      return;
    }
    if (!draft) {
      await client.chat.postMessage({ channel: dmChannel, text: 'I came up empty on a draft — there may not be enough in the thread yet.' });
      return;
    }

    /** @type {any[]} */
    const blocks = [
      { type: 'section', text: { type: 'mrkdwn', text: `✍️ *Suggested reply* — review, tweak, then post:` } },
      { type: 'section', text: { type: 'mrkdwn', text: `>>> ${draft}` } },
    ];

    // Only offer "Post to thread" when the draft fits in a button value.
    const canPost = ctx.customerChannelId && ctx.rootTs && draft.length <= MAX_VALUE;
    /** @type {any[]} */
    const elements = [
      { type: 'button', text: { type: 'plain_text', text: '🔁 Regenerate', emoji: true }, action_id: 'draft_reply' },
    ];
    if (canPost) {
      elements.unshift({
        type: 'button',
        style: 'primary',
        text: { type: 'plain_text', text: '📨 Post to thread', emoji: true },
        action_id: 'post_draft',
        value: JSON.stringify({ channelId: ctx.customerChannelId, rootTs: ctx.rootTs, draft }),
      });
    }
    blocks.push({ type: 'actions', elements });
    if (!canPost) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: 'Copy this into the thread to send.' }] });
    }

    await client.chat.postMessage({ channel: dmChannel, text: `Suggested reply:\n${draft}`, blocks });
  } catch (e) {
    logger.error(`Failed to draft reply: ${e}`);
  }
}

/**
 * "📨 Post to thread" → post the approved draft into the customer thread.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockButtonAction>} args
 * @returns {Promise<void>}
 */
export async function handlePostDraft({ ack, body, client, respond, logger }) {
  await ack();

  try {
    const { channelId, rootTs, draft } = JSON.parse(body.actions[0].value || '{}');
    if (!channelId || !rootTs || !draft) return;

    await client.chat.postMessage({ channel: channelId, thread_ts: rootTs, text: draft });
    await respond({ replace_original: false, text: '✅ Posted to the thread.' });
  } catch (e) {
    logger.error(`Failed to post draft: ${e}`);
  }
}
