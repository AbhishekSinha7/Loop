import { startConnect, redirectUri, redirectConfigured } from '../../salesforce/connect.js';
import { getSfConnection } from '../../db/index.js';

/**
 * Modal shown when Loop's public callback URL isn't configured by the operator.
 * @returns {any}
 */
function notConfiguredModal() {
  return {
    type: 'modal',
    title: { type: 'plain_text', text: 'Connect Salesforce' },
    close: { type: 'plain_text', text: 'Close' },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: "⚠️ Salesforce connections aren't fully set up on this Loop instance yet.\n\nThe Loop administrator needs to set a public `PUBLIC_URL` (the app's HTTPS address) so Salesforce can redirect back here. Once that's configured, this button will walk you through connecting your org.",
        },
      },
    ],
  };
}

/**
 * @param {{ blockId: string, label: string, placeholder?: string, optional?: boolean, initial?: string|null, hint?: string }} o
 * @returns {any}
 */
function input({ blockId, label, placeholder = '', optional = false, initial = null, hint = '' }) {
  return {
    type: 'input',
    block_id: blockId,
    optional,
    label: { type: 'plain_text', text: label },
    ...(hint ? { hint: { type: 'plain_text', text: hint } } : {}),
    element: {
      type: 'plain_text_input',
      action_id: 'v',
      ...(initial ? { initial_value: initial } : {}),
      ...(placeholder ? { placeholder: { type: 'plain_text', text: placeholder } } : {}),
    },
  };
}

/**
 * App Home "Connect Salesforce" button → open the config modal.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockButtonAction>} args
 * @returns {Promise<void>}
 */
export async function handleConnectSalesforce({ ack, body, client, context, logger }) {
  await ack();
  try {
    if (!redirectConfigured()) {
      await client.views.open({ trigger_id: body.trigger_id, view: notConfiguredModal() });
      return;
    }
    // Prefill existing values so this doubles as an edit form (secrets aren't echoed).
    const teamId = /** @type {string} */ (context.teamId || body.team?.id);
    const existing = await getSfConnection(teamId);
    const secretSet = !!existing?.clientSecret;

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'sf_connect_modal',
        title: { type: 'plain_text', text: existing ? 'Edit Salesforce' : 'Connect Salesforce' },
        submit: { type: 'plain_text', text: 'Continue' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: `In your Salesforce *External Client App*, set the OAuth callback URL to:\n\`${redirectUri()}\`` } },
          { type: 'context', elements: [{ type: 'mrkdwn', text: 'Setup → External Client App Manager → your app → OAuth Settings. Enable PKCE; scopes: `mcp_api`, `refresh_token`.' }] },
          input({ blockId: 'login_url', label: 'My Domain / login URL', placeholder: 'https://yourorg.my.salesforce.com', initial: existing?.loginUrl, hint: 'Setup → My Domain (or login.salesforce.com / test.salesforce.com for prod/sandbox).' }),
          input({ blockId: 'mcp_url', label: 'Hosted MCP server URL', placeholder: 'https://api.salesforce.com/platform/mcp/v1/...', initial: existing?.mcpUrl, hint: 'From your Salesforce hosted MCP server setup page.' }),
          input({ blockId: 'client_id', label: 'External Client App consumer key (client_id)', initial: existing?.clientId, hint: 'External Client App → Settings → OAuth → Consumer Key.' }),
          input({ blockId: 'client_secret', label: 'Client secret (optional)', placeholder: secretSet ? '•••• already set (blank = keep)' : 'only if your app keeps one', optional: true, hint: 'Consumer Secret, only if your External Client App requires one.' }),
        ],
      },
    });
  } catch (e) {
    logger.error(`Connect Salesforce modal failed: ${e}`);
  }
}

/**
 * Modal submit → validate, save config, and update the modal with the
 * "Authorize in Salesforce" link (which kicks off the OAuth redirect).
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackViewMiddlewareArgs} args
 * @returns {Promise<void>}
 */
export async function handleSfConnectSubmit({ ack, body, view, context, logger }) {
  const vals = /** @type {any} */ (view.state.values);
  /** @param {string} b */
  const get = (b) => (vals[b]?.v?.value || '').trim();
  const loginUrl = get('login_url');
  const mcpUrl = get('mcp_url');
  const clientId = get('client_id');
  const clientSecret = get('client_secret');
  const teamId = /** @type {string} */ (context.teamId || body.team?.id);

  /** @type {Record<string, string>} */
  const errors = {};
  if (!loginUrl) errors.login_url = 'Required';
  if (!mcpUrl) errors.mcp_url = 'Required';
  if (!clientId) errors.client_id = 'Required';
  if (Object.keys(errors).length > 0) {
    await ack({ response_action: 'errors', errors });
    return;
  }

  if (!redirectConfigured()) {
    await ack({ response_action: 'update', view: notConfiguredModal() });
    return;
  }

  try {
    const { url } = startConnect({ teamId, mcpUrl, loginUrl, clientId, clientSecret: clientSecret || undefined });
    await ack({
      response_action: 'update',
      view: {
        type: 'modal',
        title: { type: 'plain_text', text: 'Connect Salesforce' },
        close: { type: 'plain_text', text: 'Done' },
        blocks: [
          { type: 'section', text: { type: 'mrkdwn', text: '✅ Config saved. Click below to authorize Loop in your Salesforce org, approve, then close the tab — Loop will be connected.' } },
          { type: 'actions', elements: [{ type: 'button', text: { type: 'plain_text', text: 'Authorize in Salesforce' }, url, style: 'primary' }] },
        ],
      },
    });
  } catch (e) {
    logger.error(`Salesforce connect submit failed: ${e}`);
    await ack();
  }
}
