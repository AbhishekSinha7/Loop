/**
 * Build the App Home Block Kit view.
 * @param {string | null} [installUrl] - OAuth install URL shown when MCP is disconnected.
 * @param {boolean} [isConnected] - Whether the Slack MCP Server is connected.
 * @param {{ threads: Array<{ channelId: string, handoffCount: number, looped: string[], updatedAt: number }>, expertise: Array<{ topic: string, experts: Array<{ userId: string, count: number }> }>, cases: any[], sfConnected?: boolean, anthropicConfigured?: boolean } | null} [dashboard] - Loop activity to render.
 * @returns {import('@slack/types').HomeView}
 */
export function buildAppHomeView(installUrl = null, isConnected = false, dashboard = null) {
  /** @type {import('@slack/types').KnownBlock[]} */
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: "Hey there :wave: I'm your Slack assistant.",
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text:
          "I'm here to help! You can ask me questions, have a conversation, " +
          'or ask me to do things in Slack.\n\n' +
          'Send me a *direct message* or *mention me in a channel* to get started.',
      },
    },
    { type: 'divider' },
  ];

  if (isConnected) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '\ud83d\udfe2 *Slack MCP Server is connected.*',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'The agent can search messages, read channels, and more.',
          },
        ],
      },
    );
  } else if (installUrl) {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `\ud83d\udd34 *Slack MCP Server is disconnected.* <${installUrl}|Connect the Slack MCP Server.>`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'The Slack MCP Server enables the agent to search messages, read channels, and more.',
          },
        ],
      },
    );
  } else {
    blocks.push(
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: '\ud83d\udd34 *Slack MCP Server is disconnected.* <https://github.com/slack-samples/bolt-js-starter-agent/blob/main/claude-agent-sdk/README.md#slack-mcp-server|Learn how to enable the Slack MCP Server.>',
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: 'The Slack MCP Server enables the agent to search messages, read channels, and more.',
          },
        ],
      },
    );
  }

  if (dashboard) {
    blocks.push(
      { type: 'divider' },
      { type: 'header', text: { type: 'plain_text', text: '📋 Loop — Customer Whisperer', emoji: true } },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: dashboard.anthropicConfigured ? '🤖 *Claude (Anthropic):* configured' : '🤖 *Claude (Anthropic):* not configured — required' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: dashboard.anthropicConfigured ? 'Edit API key' : 'Add API key' },
          action_id: 'open_settings',
          ...(dashboard.anthropicConfigured ? {} : { style: 'primary' }),
        },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: dashboard.sfConnected ? '🧾 *Salesforce:* connected' : '🧾 *Salesforce:* not connected' },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: dashboard.sfConnected ? 'Edit Salesforce' : 'Connect Salesforce' },
          action_id: 'connect_salesforce',
          ...(dashboard.sfConnected ? {} : { style: 'primary' }),
        },
      },
      { type: 'section', text: { type: 'mrkdwn', text: '*🔁 Active customer threads*' } },
    );
    if (dashboard.threads.length === 0) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_No customer threads yet._' }] });
    } else {
      for (const t of dashboard.threads) {
        const hot = t.handoffCount >= 3 ? ' 🔥' : '';
        const looped = t.looped.length ? ` · ${t.looped.map((u) => `<@${u}>`).join(', ')}` : '';
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*<#${t.channelId}>*${hot} · 🔁 ${t.handoffCount} · ${timeAgo(t.updatedAt)}${looped}` },
        });
      }
    }

    blocks.push({ type: 'divider' }, { type: 'section', text: { type: 'mrkdwn', text: '*🧠 Who knows what*' } });
    if (dashboard.expertise.length === 0) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_No expertise recorded yet._' }] });
    } else {
      for (const e of dashboard.expertise) {
        const experts = e.experts.slice(0, 3).map((x) => `<@${x.userId}> (${x.count})`).join(', ');
        blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${e.topic}* — ${experts}` } });
      }
    }

    blocks.push({ type: 'divider' }, { type: 'section', text: { type: 'mrkdwn', text: '*🧾 Recent Salesforce cases*' } });
    if (dashboard.cases.length === 0) {
      blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: '_No cases looked up yet._' }] });
    } else {
      for (const c of dashboard.cases) {
        const tag = c.mock ? ' _(mock)_' : '';
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: `*Case ${c.caseNumber}* · ${c.accountName} (${c.accountTier}) · ${c.status}${tag}` },
        });
      }
    }
  }

  return { type: 'home', blocks };
}

/**
 * @param {number} ts
 * @returns {string}
 */
function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - (ts || 0)) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
