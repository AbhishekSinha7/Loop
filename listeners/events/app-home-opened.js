import { buildAppHomeView } from '../views/app-home-builder.js';
import { recentThreads, handoffsForThread, expertiseSummary, recentCases, getSfConnection, getAppSettings } from '../../db/index.js';

/**
 * Publish the App Home view when a user opens the app's Home tab.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackEventMiddlewareArgs<'app_home_opened'>} args
 * @returns {Promise<void>}
 */
export async function handleAppHomeOpened({ client, context, logger }) {
  try {
    const userId = /** @type {string} */ (context.userId);
    const teamId = /** @type {string} */ (context.teamId);
    let installUrl = null;
    let isConnected = false;

    if (process.env.SLACK_CLIENT_ID) {
      if (context.userToken) {
        isConnected = true;
      } else {
        const origin =
          (process.env.PUBLIC_URL || '').replace(/\/+$/, '') ||
          (process.env.SLACK_REDIRECT_URI ? new URL(process.env.SLACK_REDIRECT_URI).origin : null);
        if (origin) installUrl = `${origin}/slack/install`;
      }
    }

    const dashboard = {
      threads: recentThreads(teamId, 6).map((t) => {
        const hs = handoffsForThread(teamId, t.id);
        return {
          channelId: t.channelId,
          handoffCount: hs.length,
          looped: [...new Set(hs.map((h) => h.toId).filter(Boolean))],
          updatedAt: t.updatedAt,
        };
      }),
      expertise: expertiseSummary(teamId),
      cases: recentCases(teamId, 5),
      sfConnected: !!getSfConnection(teamId),
      anthropicConfigured: !!getAppSettings(teamId)?.anthropicKey,
    };
    const view = buildAppHomeView(installUrl, isConnected, dashboard);
    await client.views.publish({ user_id: userId, view });
  } catch (e) {
    logger.error(`Failed to publish App Home: ${e}`);
  }
}
