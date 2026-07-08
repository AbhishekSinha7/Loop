import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BriefContextStore, buildFollowupPrompt } from '../../thread-context/brief-context.js';

describe('BriefContextStore', () => {
  it('stores and retrieves context by DM channel', () => {
    const store = new BriefContextStore();
    const ctx = { customerChannelId: 'C1', transcript: 'a: hi' };
    store.set('D1', ctx);
    assert.deepEqual(store.get('D1'), ctx);
    assert.equal(store.get('D2'), null);
  });

  it('expires entries past the TTL', () => {
    const store = new BriefContextStore(-1); // negative TTL → already stale on read
    store.set('D1', { customerChannelId: 'C1', transcript: 't' });
    assert.equal(store.get('D1'), null);
  });

  it('deletes entries', () => {
    const store = new BriefContextStore();
    store.set('D1', { customerChannelId: 'C1', transcript: 't' });
    store.delete('D1');
    assert.equal(store.get('D1'), null);
  });

  it('evicts oldest entries past maxEntries', () => {
    const store = new BriefContextStore(86400, 2);
    store.set('D1', { customerChannelId: 'C1', transcript: '1' });
    store.set('D2', { customerChannelId: 'C2', transcript: '2' });
    store.set('D3', { customerChannelId: 'C3', transcript: '3' });
    assert.equal(store.get('D1'), null); // oldest evicted
    assert.ok(store.get('D3'));
  });
});

describe('buildFollowupPrompt', () => {
  it('includes the customer channel, brief fields, and the follow-up', () => {
    const ctx = {
      customerChannelId: 'C123',
      transcript: 'maria: SSO is broken',
      summary: { issue: 'SSO fails', tried: 'rotated cert', pending: 'still failing' },
      caseContext: { caseNumber: '00012345', status: 'Escalated', accountName: 'Acme', accountTier: 'Enterprise', priorCases: 4, recentActivity: 'paged owner' },
      related: { summary: 'similar in #support last month' },
      topic: 'SSO login',
    };
    const out = buildFollowupPrompt(ctx, 'what was the error code?');
    assert.match(out, /<#C123>/);
    assert.match(out, /SSO fails/);
    assert.match(out, /Case 00012345/);
    assert.match(out, /similar in #support/);
    assert.match(out, /what was the error code\?/);
  });

  it('omits optional sections when absent', () => {
    const out = buildFollowupPrompt({ customerChannelId: 'C1', transcript: 't' }, 'hi');
    assert.match(out, /<#C1>/);
    assert.doesNotMatch(out, /Salesforce:/);
    assert.doesNotMatch(out, /Seen before:/);
  });
});
