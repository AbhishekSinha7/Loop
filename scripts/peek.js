// Read-only dump of the Loop SQLite store, grouped by team.
//   node scripts/peek.js
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.LOOP_DB_PATH || join(here, '..', 'loop.db');

if (!existsSync(DB_PATH)) {
  console.log('No loop.db yet — do a handoff first.');
  process.exit(0);
}

const db = new DatabaseSync(DB_PATH);

const teams = db
  .prepare('SELECT team_id FROM threads UNION SELECT team_id FROM expertise UNION SELECT team_id FROM cases')
  .all()
  .map((r) => r.team_id);

if (teams.length === 0) {
  console.log('Store is empty.');
  process.exit(0);
}

for (const team of teams) {
  const threads = db.prepare('SELECT * FROM threads WHERE team_id = ? ORDER BY updated_at DESC').all(team);
  const handoffCount = db.prepare('SELECT COUNT(*) c FROM handoffs WHERE team_id = ?').get(team).c;
  const cases = db.prepare('SELECT data FROM cases WHERE team_id = ?').all(team);
  const expertise = db.prepare('SELECT topic, user_id, count FROM expertise WHERE team_id = ? ORDER BY topic, count DESC').all(team);

  console.log(`\n=== team ${team} ===`);
  console.log(`threads: ${threads.length}  handoffs: ${handoffCount}  cases: ${cases.length}`);

  console.log('  recent threads:');
  for (const t of threads.slice(0, 10)) {
    const n = db.prepare('SELECT COUNT(*) c FROM handoffs WHERE team_id = ? AND thread_id = ?').get(team, t.id).c;
    const who = db
      .prepare('SELECT DISTINCT to_id FROM handoffs WHERE team_id = ? AND thread_id = ? AND to_id IS NOT NULL')
      .all(team, t.id)
      .map((r) => r.to_id);
    console.log(`    ${t.channel_id}  handoffs:${n}  -> ${who.join(', ') || '-'}`);
  }

  console.log('  expertise:');
  /** @type {Record<string, string[]>} */
  const byTopic = {};
  for (const e of expertise) (byTopic[e.topic] ||= []).push(`${e.user_id}:${e.count}`);
  for (const [topic, list] of Object.entries(byTopic)) console.log(`    ${topic}: ${list.join('  ')}`);

  console.log('  cases:');
  for (const c of cases) {
    const d = JSON.parse(c.data);
    console.log(`    ${d.caseNumber}  ${d.accountName} (${d.accountTier})  ${d.status}`);
  }
}
console.log('');
