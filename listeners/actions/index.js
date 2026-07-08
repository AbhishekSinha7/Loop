import { handleFeedbackButton } from './feedback-buttons.js';
import { handleLoopInExpert } from './loop-in-expert.js';
import { handleConnectSalesforce } from './connect-salesforce.js';
import { handleDraftReply, handlePostDraft } from './draft-reply.js';
import { handleOpenSettings } from './settings.js';

/**
 * Register action listeners with the Bolt app.
 * @param {import('@slack/bolt').App} app
 * @returns {void}
 */
export function register(app) {
  app.action('feedback', handleFeedbackButton);
  app.action('loop_in_expert', handleLoopInExpert);
  app.action('connect_salesforce', handleConnectSalesforce);
  app.action('draft_reply', handleDraftReply);
  app.action('post_draft', handlePostDraft);
  app.action('open_settings', handleOpenSettings);
}
