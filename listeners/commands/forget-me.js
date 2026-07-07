import { deleteUserMemory } from '../../db/index.js';

/**
 * /forget-me — erase the caller's stored conversation memory with the bot.
 * Scoped to the requesting user only (team + user), so it never touches anyone else.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackCommandMiddlewareArgs} args
 * @returns {Promise<void>}
 */
export async function handleForgetMe({ ack, context, command, respond, logger }) {
  await ack();

  try {
    const teamId = /** @type {string} */ (context.teamId || command.team_id);
    const userId = /** @type {string} */ (context.userId || command.user_id);
    deleteUserMemory(teamId, userId);
    await respond({
      response_type: 'ephemeral',
      text: '🧹 Done — I’ve forgotten our past conversations. New chats start fresh.',
    });
  } catch (e) {
    logger.error(`Failed to forget user memory: ${e}`);
    await respond({ response_type: 'ephemeral', text: 'Sorry, I couldn’t clear your memory just now. Try again in a moment.' });
  }
}
