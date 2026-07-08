import { getThreadBySlack, recordHandoff, recordExpertise } from '../../db/index.js';

/**
 * "Loop them in" — pull the suggested expert into the original thread and
 * record it, so the expertise map keeps learning.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockButtonAction>} args
 * @returns {Promise<void>}
 */
export async function handleLoopInExpert({ ack, body, client, context, respond, logger }) {
  await ack();

  try {
    const teamId = /** @type {string} */ (context.teamId);
    const { channelId, rootTs, expertId, topic } = JSON.parse(body.actions[0].value || '{}');
    if (!channelId || !expertId) return;

    await client.chat.postMessage({
      channel: channelId,
      thread_ts: rootTs,
      text: `👋 <@${expertId}> — looping you in${topic ? ` on this *${topic}*` : ''} thread; you've handled similar ones before. _(suggested by Loop)_`,
    });

    const thread = getThreadBySlack(teamId, channelId, rootTs);
    if (thread) recordHandoff(teamId, { threadId: thread.id, toId: expertId });
    if (topic) recordExpertise(teamId, { userId: expertId, topic });

    await respond({ replace_original: false, text: `✅ Looped in <@${expertId}>.` });
    logger.debug(`Looped in expert ${expertId} for topic ${topic}`);
  } catch (e) {
    logger.error(`Failed to loop in expert: ${e}`);
  }
}
