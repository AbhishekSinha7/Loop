import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildBrief } from '../../brief/build-brief.js';

/** collect every action_id present in the blocks */
function actionIds(blocks) {
  const ids = [];
  for (const b of blocks) {
    if (b.type === 'actions') for (const el of b.elements) if (el.action_id) ids.push(el.action_id);
  }
  return ids;
}

describe('buildBrief', () => {
  const base = { channelId: 'C1', messages: [{ user: 'U1', text: 'help' }], nameOf: (/** @type {string} */ u) => u };

  it('always offers a "Draft a reply" button', () => {
    const { blocks } = buildBrief(base);
    assert.ok(actionIds(blocks).includes('draft_reply'));
  });

  it('renders the structured brief when a summary is present', () => {
    const { blocks } = buildBrief({ ...base, summary: { issue: 'X broke', tried: 'restarted', pending: 'logs?' } });
    const text = JSON.stringify(blocks);
    assert.match(text, /X broke/);
    assert.match(text, /restarted/);
  });

  it('includes the Salesforce + seen-before sections when provided', () => {
    const { blocks } = buildBrief({
      ...base,
      caseContext: { caseNumber: '00012345', status: 'Open', accountName: 'Acme', accountTier: 'Enterprise', priorCases: 2, recentActivity: 'paged' },
      related: { summary: 'similar in #support' },
    });
    const text = JSON.stringify(blocks);
    assert.match(text, /Case 00012345/);
    assert.match(text, /Seen before/);
  });
});
