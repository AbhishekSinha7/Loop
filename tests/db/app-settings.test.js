import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { describe, it, before } from 'node:test';

process.env.LOOP_DB_PATH = join(tmpdir(), `loop-settings-test-${randomUUID()}.db`);

/** @type {typeof import('../../db/index.js')} */
let db;
before(async () => {
  db = await import('../../db/index.js');
});

describe('app_settings (Anthropic key)', () => {
  it('stores and reads a team key, isolated per team', async () => {
    await db.setAppSettings('T1', { anthropicKey: 'sk-ant-team1' });
    await db.setAppSettings('T2', { anthropicKey: 'sk-ant-team2' });
    assert.equal((await db.getAppSettings('T1'))?.anthropicKey, 'sk-ant-team1');
    assert.equal((await db.getAppSettings('T2'))?.anthropicKey, 'sk-ant-team2');
    assert.equal(await db.getAppSettings('T_NONE'), null);
  });

  it('updates without wiping when key omitted (COALESCE keep)', async () => {
    await db.setAppSettings('T3', { anthropicKey: 'sk-ant-orig' });
    await db.setAppSettings('T3', {}); // no key provided → keep existing
    assert.equal((await db.getAppSettings('T3'))?.anthropicKey, 'sk-ant-orig');
  });

  it('deleteTeamData purges settings', async () => {
    await db.setAppSettings('T4', { anthropicKey: 'sk-ant-gone' });
    await db.deleteTeamData('T4');
    assert.equal(await db.getAppSettings('T4'), null);
  });
});
