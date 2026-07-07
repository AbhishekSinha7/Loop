import { handleSfConnectSubmit } from '../actions/connect-salesforce.js';
import { handleSettingsSubmit } from '../actions/settings.js';

/**
 * Register view listeners with the Bolt app.
 * @param {import('@slack/bolt').App} app
 * @returns {void}
 */
export function register(app) {
  app.view('sf_connect_modal', handleSfConnectSubmit);
  app.view('loop_settings_modal', handleSettingsSubmit);
}
