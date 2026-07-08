import { handleCustomerHistory } from './customer-history.js';
import { handleForgetMe } from './forget-me.js';

/**
 * Register slash-command listeners with the Bolt app.
 * @param {import('@slack/bolt').App} app
 * @returns {void}
 */
export function register(app) {
  app.command('/customer-history', handleCustomerHistory);
  app.command('/forget-me', handleForgetMe);
}
