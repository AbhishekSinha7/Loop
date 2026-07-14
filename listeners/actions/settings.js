import { getAppSettings, setAppSettings } from '../../db/index.js';

/**
 * App Home "Settings" button → modal to enter/update the workspace's Anthropic API key.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackActionMiddlewareArgs<import('@slack/bolt').BlockButtonAction>} args
 * @returns {Promise<void>}
 */
export async function handleOpenSettings({ ack, body, client, context, logger }) {
  await ack();
  try {
    const teamId = /** @type {string} */ (context.teamId || body.team?.id);
    const hasKey = !!(await getAppSettings(teamId))?.anthropicKey;

    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: 'modal',
        callback_id: 'loop_settings_modal',
        title: { type: 'plain_text', text: 'Loop settings' },
        submit: { type: 'plain_text', text: 'Save' },
        close: { type: 'plain_text', text: 'Cancel' },
        blocks: [
          {
            type: 'section',
            text: { type: 'mrkdwn', text: '*Anthropic API key*\nLoop uses Claude to detect handoffs, write briefs, draft replies, and power the assistant.' },
          },
          {
            type: 'input',
            block_id: 'anthropic_key',
            optional: hasKey, // required first time; optional once set (blank = keep)
            label: { type: 'plain_text', text: hasKey ? 'API key (leave blank to keep current)' : 'API key' },
            element: {
              type: 'plain_text_input',
              action_id: 'v',
              placeholder: { type: 'plain_text', text: hasKey ? '•••• already configured' : 'sk-ant-...' },
            },
          },
          {
            type: 'context',
            elements: [
              { type: 'mrkdwn', text: '🔑 Get a key at <https://console.anthropic.com/settings/keys|console.anthropic.com → Settings → API keys>. Stored encrypted; used only for your workspace.' },
            ],
          },
        ],
      },
    });
  } catch (e) {
    logger.error(`Open settings failed: ${e}`);
  }
}

/**
 * Save the Anthropic API key from the settings modal.
 * @param {import('@slack/bolt').AllMiddlewareArgs & import('@slack/bolt').SlackViewMiddlewareArgs} args
 * @returns {Promise<void>}
 */
export async function handleSettingsSubmit({ ack, body, view, context, logger }) {
  const teamId = /** @type {string} */ (context.teamId || body.team?.id);
  const vals = /** @type {any} */ (view.state.values);
  const key = (vals.anthropic_key?.v?.value || '').trim();

  // Require a key the first time (no existing one and none entered).
  if (!key && !(await getAppSettings(teamId))?.anthropicKey) {
    await ack({ response_action: 'errors', errors: { anthropic_key: 'An Anthropic API key is required' } });
    return;
  }

  await ack();
  try {
    if (key) await setAppSettings(teamId, { anthropicKey: key });
  } catch (e) {
    logger.error(`Save settings failed: ${e}`);
  }
}
