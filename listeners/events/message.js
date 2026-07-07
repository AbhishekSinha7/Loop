import { runAgent } from '../../agent/index.js';
import { sessionStore, briefContextStore } from '../../thread-context/index.js';
import { buildFollowupPrompt } from '../../thread-context/brief-context.js';
import { buildMemoryPrompt } from '../../thread-context/user-memory.js';
import { recentUserTurns, recordUserTurn } from '../../db/index.js';
import { buildFeedbackBlocks } from '../views/feedback-builder.js';

/**
 * @param {import('@slack/types').MessageEvent} event
 * @returns {event is import('@slack/types').GenericMessageEvent}
 */
function isGenericMessageEvent(event) {
  return !('subtype' in event && event.subtype !== undefined);
}

/**
 * Handle messages sent to the agent via DM or in threads the bot is part of.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackEventMiddlewareArgs<'message'>} args
 * @returns {Promise<void>}
 */
export async function handleMessage({ client, context, event, logger, say, sayStream, setStatus }) {
  // Skip message subtypes (edits, deletes, etc.)
  if (!isGenericMessageEvent(event)) return;

  // Skip bot messages
  if (event.bot_id) return;

  const isDm = event.channel_type === 'im';
  const isThreadReply = !!event.thread_ts;

  if (isDm) {
    // DMs are always handled
  } else if (isThreadReply) {
    // Channel thread replies are handled only if the bot is already engaged
    const session = sessionStore.getSession(event.channel, /** @type {string} */ (event.thread_ts));
    if (session === null) return;
  } else {
    // Top-level channel messages are handled by app_mentioned
    return;
  }

  try {
    const channelId = event.channel;
    const text = event.text || '';
    const threadTs = event.thread_ts || event.ts;
    const userId = /** @type {string} */ (context.userId);
    const teamId = /** @type {string} */ (context.teamId);

    // Get session ID for conversation context
    const existingSessionId = sessionStore.getSession(channelId, threadTs);

    // On a fresh conversation (no live session), seed the first turn with context.
    // A handoff-brief follow-up wins; otherwise recall this user's OWN prior chats
    // so the bot remembers past conversations across threads/restarts.
    let prompt = text;
    if (!existingSessionId) {
      const briefContext = isDm ? briefContextStore.get(channelId) : null;
      if (briefContext) {
        prompt = buildFollowupPrompt(briefContext, text);
      } else {
        const memory = buildMemoryPrompt(recentUserTurns(teamId, userId), text);
        if (memory) prompt = memory;
      }
    }

    // Set assistant thread status with loading messages
    await setStatus({
      status: 'Thinking\u2026',
      loading_messages: [
        'Teaching the hamsters to type faster\u2026',
        'Untangling the internet cables\u2026',
        'Consulting the office goldfish\u2026',
        'Polishing up the response just for you\u2026',
        'Convincing the AI to stop overthinking\u2026',
      ],
    });

    // Run the agent with deps for tool access
    const deps = { client, userId, channelId, threadTs, messageTs: event.ts, userToken: context.userToken, teamId: context.teamId };
    const { responseText, sessionId: newSessionId } = await runAgent(prompt, existingSessionId ?? undefined, deps);

    // Stream response in thread with feedback buttons
    const streamer = sayStream();
    await streamer.append({ markdown_text: responseText });
    const feedbackBlocks = buildFeedbackBlocks();
    await streamer.stop({ blocks: feedbackBlocks });

    // Store session ID for future context
    if (newSessionId) {
      sessionStore.setSession(channelId, threadTs, newSessionId);
    }

    // Persist this exchange as the user's own memory (scoped by team + user).
    recordUserTurn(teamId, userId, 'user', text);
    if (responseText) recordUserTurn(teamId, userId, 'assistant', responseText);
  } catch (e) {
    logger.error(`Failed to handle message: ${e}`);
    await say({
      text: `:warning: Something went wrong! (${e})`,
      thread_ts: event.thread_ts || event.ts,
    });
  }
}
