import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, it, before } from 'node:test';

// Point the data layer at a throwaway DB before importing it (node's test runner
// isolates each test file in its own process, so this env set is safe).
process.env.LOOP_DB_PATH = join(tmpdir(), `loop-mem-test-${randomUUID()}.db`);

/** @type {typeof import('../../db/index.js')} */
let db;
before(async () => {
  db = await import('../../db/index.js');
});

describe('user_memory isolation', () => {
  it('only returns a user\'s own turns — never another user\'s or team\'s', () => {
    db.recordUserTurn('T1', 'U1', 'user', 'U1 secret question');
    db.recordUserTurn('T1', 'U1', 'assistant', 'answer to U1');
    db.recordUserTurn('T1', 'U2', 'user', 'U2 secret question');
    db.recordUserTurn('T2', 'U1', 'user', 'other-team U1 question');

    const u1 = db.recentUserTurns('T1', 'U1');
    const contents = u1.map((t) => t.content);
    assert.deepEqual(contents, ['U1 secret question', 'answer to U1']); // oldest-first, only U1@T1
    assert.ok(!contents.some((c) => c.includes('U2')));
    assert.ok(!contents.some((c) => c.includes('other-team')));

    // U2 sees only their own; cross-team U1 is separate.
    assert.deepEqual(db.recentUserTurns('T1', 'U2').map((t) => t.content), ['U2 secret question']);
    assert.deepEqual(db.recentUserTurns('T2', 'U1').map((t) => t.content), ['other-team U1 question']);
  });

  it('deleteUserMemory forgets one user without touching others', () => {
    db.recordUserTurn('T9', 'A', 'user', 'a-msg');
    db.recordUserTurn('T9', 'B', 'user', 'b-msg');
    db.deleteUserMemory('T9', 'A');
    assert.equal(db.recentUserTurns('T9', 'A').length, 0);
    assert.equal(db.recentUserTurns('T9', 'B').length, 1);
  });

  it('deleteTeamData purges a team\'s memory', () => {
    db.recordUserTurn('T_PURGE', 'X', 'user', 'gone soon');
    db.deleteTeamData('T_PURGE');
    assert.equal(db.recentUserTurns('T_PURGE', 'X').length, 0);
  });

  it('ignores empty / missing identifiers', () => {
    db.recordUserTurn('', 'U', 'user', 'x');
    db.recordUserTurn('T', '', 'user', 'x');
    assert.deepEqual(db.recentUserTurns('', 'U'), []);
    assert.deepEqual(db.recentUserTurns('T', ''), []);
  });
});
