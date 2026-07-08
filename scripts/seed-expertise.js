// Seed the expertise map so the routing suggestion fires on your first test
// handoff. Writes straight to the SQLite store (loop.db), which the app reads
// live — so this takes effect immediately, even while the app is running.
//
//   node scripts/seed-expertise.js <TEAM_ID> <USER_ID> <topic> [count]
//   node scripts/seed-expertise.js T0123ABC U0123ABC "login / SSO" 5
//
// Get a USER_ID in Slack: profile -> ... -> Copy member ID (starts with "U").
// Get the TEAM_ID from `node scripts/peek.js` after one event, or your workspace admin page.
import { recordExpertise } from '../db/index.js';

const [teamId, userId, topic, countArg] = process.argv.slice(2);

if (!teamId || !userId || !topic) {
  console.error('Usage: node scripts/seed-expertise.js <TEAM_ID> <USER_ID> <topic> [count]');
  console.error('Example: node scripts/seed-expertise.js T0123ABC U0123ABC billing 3');
  process.exit(1);
}

const count = Number(countArg) || 3;
for (let i = 0; i < count; i++) recordExpertise(teamId, { userId, topic });

console.log(`Seeded ${count} "${topic}" handoff(s) for ${userId}.`);
console.log(`Now hand a "${topic}" thread to a DIFFERENT user to see the routing suggestion`);
console.log('(the app reads loop.db live — no restart needed).');
