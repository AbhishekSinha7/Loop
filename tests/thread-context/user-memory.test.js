import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildMemoryPrompt } from '../../thread-context/user-memory.js';

describe('buildMemoryPrompt', () => {
  it('returns null when there is no memory', () => {
    assert.equal(buildMemoryPrompt([], 'hi'), null);
    assert.equal(buildMemoryPrompt(undefined, 'hi'), null);
  });

  it('renders prior turns and states the privacy boundary', () => {
    const turns = [
      { role: 'user', content: 'how do I reset my API key?' },
      { role: 'assistant', content: 'Settings → API → Regenerate.' },
    ];
    const out = buildMemoryPrompt(turns, 'and the rate limit?');
    assert.match(out, /User: how do I reset my API key\?/);
    assert.match(out, /You: Settings → API/);
    assert.match(out, /and the rate limit\?/);
    // privacy framing must be present
    assert.match(out, /private to this one user/i);
    assert.match(out, /other user/i);
  });
});
