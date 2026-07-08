import { buildBrief } from '../../brief/build-brief.js';
import { upsertThread, recordHandoff, recordExpertise, topExpertForTopic, expertiseCount, getThreadBySlack, setThreadCanvasId, handoffsForThread } from '../../db/index.js';
import { classifyHandoff } from '../../agent/classify-handoff.js';
import { synthesizeBrief } from '../../agent/synthesize-brief.js';
import { inferTopic } from '../../agent/infer-topic.js';
import { parseCaseRef, getSalesforceCase } from '../../salesforce/get-case.js';
import { searchRelatedHistory } from '../../agent/related-history.js';
import { syncThreadCanvas } from '../../slack/canvas.js';
import { briefContextStore } from '../../thread-context/index.js';
/**
 * @param {import('@slack/types').MessageEvent} event
 * @returns {event is import('@slack/types').GenericMessageEvent}
 */
function isGenericMessageEvent(event) {
  return !('subtype' in event && event.subtype !== undefined);
}

/** @param {string} text */
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
 * the thread they were just pulled into. Uses Claude to confirm handoff intent
 * and synthesize the brief, falling back to a heuristic / raw-template if the
 * model is unavailable or slow.
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
  const teamId = /** @type {string} */ (context.teamId);
  const slackUserToken = context.userToken || process.env.SLACK_USER_TOKEN;

  // Pull @user mentions, excluding the bot and the author themselves.
  const mentioned = [...text.matchAll(/<@([A-Z0-9]+)(?:\|[^>]+)?>/g)].map((m) => m[1]);
  const targets = [...new Set(mentioned)].filter((u) => u !== botUserId/* && u !== author*/);
  if (targets.length === 0) return;
  // A mention isn't always a handoff — only fire on handoff-intent phrasing.
  if (!looksLikeHandoff(text)) return;

  // Confirm with the model; fall back to the heuristic if it's unavailable/slow.
  let isHandoff;
  try {
    isHandoff = await classifyHandoff(teamId, text);
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
    const threadId = await upsertThread(teamId, { channelId: event.channel, rootTs: threadTs });
    // Resolve display names (users:read) once.
    const cache = new Map();
    const nameOf = (/** @type {string} */ userId) => cache.get(userId) || userId;
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

    // Summarize the thread once — reused for everyone looped in.
    const transcript = messages
      .map((m) => `${m.user ? nameOf(m.user) : 'someone'}: ${(m.text || '').replace(/\s+/g, ' ').trim()}`)
      .join('\n');

    const caseRef = parseCaseRef(transcript);

    // Enrich in parallel: brief synthesis, Salesforce case, and related Slack history.
    const [summary, caseContext, related] = await Promise.all([
      synthesizeBrief(teamId, transcript).catch((e) => {
        logger.warn(`Brief synthesis failed, using raw template: ${e}`);
        return null;
      }),
      caseRef
        ? getSalesforceCase(teamId, caseRef).catch((e) => {
            logger.warn(`Salesforce lookup failed: ${e}`);
            return null;
          })
        : Promise.resolve(null),
      searchRelatedHistory(teamId, transcript, slackUserToken).catch((e) => {
        logger.warn(`Slack history search failed: ${e}`);
        return null;
      }),
    ]);

    // Topic drives the expertise map + routing suggestion. Prefer the model's
    // label; fall back to a keyword guess when synthesis was unavailable.
    const topic = summary?.topic || inferTopic(transcript);

    // Per-thread dossier canvas: create/update once, link it in each brief.
    let canvasLink = null;
    try {
      const existing = (await getThreadBySlack(teamId, event.channel, threadTs))?.canvasId;
      const priorHandoffs = (await handoffsForThread(teamId, threadId)).length;
      const canvas = await syncThreadCanvas({
        channelId: event.channel,
        existingCanvasId: existing,
        summary,
        caseContext,
        related,
        handoffCount: priorHandoffs + targets.length,
        loopedIn: targets,
        userToken: slackUserToken,
      });
      if (canvas) {
        canvasLink = canvas.link;
        if (!existing && canvas.canvasId) await setThreadCanvasId(teamId, event.channel, threadTs, canvas.canvasId);
      }
    } catch (e) {
      logger.warn(`Canvas sync failed: ${e}`);
    }

    for (const userId of targets) {
      const handoffCount = await recordHandoff(teamId, { threadId, fromId: author, toId: userId });

      // Is there a stronger expert in this topic than the person being looped in?
      let suggestion = null;
      if (topic) {
        const expert = await topExpertForTopic(teamId, topic, [userId, author, botUserId]);
        if (expert && expert.count > (await expertiseCount(teamId, topic, userId))) {
          suggestion = { expertId: expert.userId, topic, channelId: event.channel, rootTs: threadTs };
        }
        await recordExpertise(teamId, { userId, topic }); // being looped in builds topic expertise
      }

      const brief = buildBrief({ channelId: event.channel, messages, nameOf, handoffCount, summary, suggestion, caseContext, related, canvasLink });
      const dm = await client.conversations.open({ users: userId });
      const dmChannel = dm.channel?.id;
      if (!dmChannel) continue;
      await client.chat.postMessage({ channel: dmChannel, text: brief.text, blocks: brief.blocks });

      // Remember this brief's context so a follow-up reply in the DM is answered
      // with the full handoff context (see listeners/events/message.js), and so the
      // "Draft a reply" button can ground its draft and post it back to the thread.
      briefContextStore.set(dmChannel, { customerChannelId: event.channel, rootTs: threadTs, transcript, summary, caseContext, related, topic });
    }
  } catch (e) {
    logger.error(`Failed to send handoff brief: ${e}`);
  }
}