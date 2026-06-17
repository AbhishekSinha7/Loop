import { buildBrief } from '../../brief/build-brief.js';
import { upsertThread, recordHandoff } from '../../db/index.js';
import { classifyHandoff } from '../../agent/classify-handoff.js';
/**
 * @param {import('@slack/types').MessageEvent} event
 * @returns {event is import('@slack/types').GenericMessageEvent}
 */
function isGenericMessageEvent(event) {
  return !('subtype' in event && event.subtype !== undefined);
}

function looksLikeHandoff(text) {
  const t = (text || '').toLowerCase();
  // Suppress obvious non-handoffs.
  if (/\b(thanks|thank you|thx|fyi|cc|nice work|great job|well done)\b/.test(t)) return false;
  // Handoff intent.
  if (/\b(can|could|would|will) you\b.*\b(take|handle|look|help|cover|jump|own|grab|pick up|field|run with)\b/.test(t)) return true;
  if (/\b(take|handle|cover|own|field) (this|the|that)\b/.test(t)) return true;
  if (/\b(over to you|your turn|handing (this|it)|passing (this|it)|assigning (this|it)|assign(ed)? to|looping you in|loop you in|pulling you in|bringing you in|take it from here|ptal|please take a look|jump on this)\b/.test(t)) return true;
  return false;
}

/**
 * When someone @mentions a user in a channel message, DM that user a brief of
 * the thread they were just pulled into. KEYLESS — no LLM, no API key.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackEventMiddlewareArgs<'message'>} args
 * @returns {Promise<void>}
 */
export async function handleHandoff({ client, context, event, logger }) {
  if (!isGenericMessageEvent(event)) return;
  if (event.bot_id) return;
  if (event.channel_type === 'im') return; // DMs belong to the stock assistant

  const text = event.text || '';
  const botUserId = context.botUserId;
  const author = event.user;

  // Pull @user mentions, excluding the bot and the author themselves.
  const mentioned = [...text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g)].map((m) => m[1]);
  const targets = [...new Set(mentioned)].filter((u) => u !== botUserId/* && u !== author*/);
  if (targets.length === 0) return;
  // A mention isn't always a handoff — only fire on handoff-intent phrasing.
  if (!looksLikeHandoff(text)) return;

  // Is this actually a handoff? Ask the model; fall back to the heuristic if it's unavailable.
  let isHandoff;
  try {
    isHandoff = await classifyHandoff(text);
  } catch (e) {
    logger.warn(`Handoff classifier unavailable, using heuristic: ${e}`);
    isHandoff = looksLikeHandoff(text);
  }
  if (!isHandoff) return;

  // OPTIONAL: scope to customer channels once you adopt a convention.
  // const CUSTOMER_CHANNELS = new Set(['C0XXXXXXX']);
  // if (!CUSTOMER_CHANNELS.has(event.channel)) return;

  try {
    const threadTs = event.thread_ts || event.ts;
    const replies = await client.conversations.replies({ channel: event.channel, ts: threadTs, limit: 50 });
    const messages = (replies.messages || []).map((m) => ({ user: m.user, text: m.text }));
    const threadId = upsertThread({ channelId: event.channel, rootTs: threadTs });
    // Resolve display names (users:read) once.
    const cache = new Map();
    const nameOf = (userId) => cache.get(userId) || userId;
    await Promise.all(
      [...new Set(messages.map((m) => m.user).filter(Boolean))].map(async (uid) => {
        try {
          const res = await client.users.info({ user: /** @type {string} */ (uid) });
          const p = res.user?.profile;
          cache.set(uid, p?.display_name || p?.real_name || res.user?.name || uid);
        } catch {
          cache.set(uid, uid);
        }
      }),
    );

    const brief = buildBrief({ channelId: event.channel, messages, nameOf });

    // for (const userId of targets) {
    //   const dm = await client.conversations.open({ users: userId });
    //   const dmChannel = dm.channel?.id;
    //   if (!dmChannel) continue;
    //   await client.chat.postMessage({ channel: dmChannel, text: brief.text, blocks: brief.blocks });
    // }
    for (const userId of targets) {
      const handoffCount = recordHandoff({ threadId, fromId: author, toId: userId });
      const brief = buildBrief({ channelId: event.channel, messages, nameOf, handoffCount });
      const dm = await client.conversations.open({ users: userId });
      const dmChannel = dm.channel?.id;
      if (!dmChannel) continue;
      await client.chat.postMessage({ channel: dmChannel, text: brief.text, blocks: brief.blocks });
    }
  } catch (e) {
    logger.error(`Failed to send handoff brief: ${e}`);
  }
}