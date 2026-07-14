import { installationStore } from '../../db/installation-store.js';

/**
 * When a workspace uninstalls Loop, delete its installation (tokens) and purge
 * all of its data. Required for Marketplace review + good tenant hygiene.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackEventMiddlewareArgs<'app_uninstalled'>} args
 * @returns {Promise<void>}
 */
export async function handleAppUninstalled({ context, logger }) {
  try {
    await installationStore.deleteInstallation?.({
      teamId: context.teamId,
      enterpriseId: context.enterpriseId,
      isEnterpriseInstall: context.isEnterpriseInstall,
    });
    logger.info(`Uninstalled — purged installation + data for ${context.enterpriseId || context.teamId}`);
  } catch (e) {
    logger.error(`Failed to purge on uninstall: ${e}`);
  }
}
