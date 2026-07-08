import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { encrypt, decrypt } from './crypto.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.LOOP_DB_PATH || join(__dirname, '..', 'loop.db');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS threads (
    team_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    root_ts TEXT NOT NULL,
    id TEXT NOT NULL,
    account TEXT,
    status TEXT,
    canvas_id TEXT,
    updated_at INTEGER,
    PRIMARY KEY (team_id, channel_id, root_ts)
  );
  CREATE TABLE IF NOT EXISTS handoffs (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    thread_id TEXT NOT NULL,
    from_id TEXT,
    to_id TEXT,
    occurred_at INTEGER,
    brief_sent INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_handoffs_thread ON handoffs (team_id, thread_id);
  CREATE TABLE IF NOT EXISTS expertise (
    team_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    user_id TEXT NOT NULL,
    count INTEGER NOT NULL,
    PRIMARY KEY (team_id, topic, user_id)
  );
  CREATE TABLE IF NOT EXISTS cases (
    team_id TEXT NOT NULL,
    case_number TEXT NOT NULL,
    data TEXT NOT NULL,
    updated_at INTEGER,
    PRIMARY KEY (team_id, case_number)
  );
  CREATE TABLE IF NOT EXISTS installations (
    install_key TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS sf_connections (
    team_id TEXT PRIMARY KEY,
    mcp_url TEXT,
    login_url TEXT,
    client_id TEXT,
    refresh_token_enc TEXT,
    client_secret_enc TEXT,
    connected_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS user_memory (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_user_memory ON user_memory (team_id, user_id, created_at);
  CREATE TABLE IF NOT EXISTS app_settings (
    team_id TEXT PRIMARY KEY,
    anthropic_key_enc TEXT,
    updated_at INTEGER
  );
`);

// Shared connection for the OAuth installation store (db/installation-store.js).
export { db };

const normTopic = (/** @type {string} */ topic) => (topic || '').trim().toLowerCase();

/**
 * Insert the thread if new, else touch it. Returns the stable thread id.
 * @param {string} teamId
 * @param {{ channelId: string, rootTs: string, account?: string | null }} input
 * @returns {string}
 */
export function upsertThread(teamId, { channelId, rootTs, account = null }) {
  const existing = db
    .prepare('SELECT id FROM threads WHERE team_id = ? AND channel_id = ? AND root_ts = ?')
    .get(teamId, channelId, rootTs);
  if (existing) {
    db.prepare('UPDATE threads SET updated_at = ?, account = COALESCE(account, ?) WHERE team_id = ? AND channel_id = ? AND root_ts = ?')
      .run(Date.now(), account, teamId, channelId, rootTs);
    return /** @type {any} */ (existing).id;
  }
  const id = randomUUID();
  db.prepare('INSERT INTO threads (team_id, channel_id, root_ts, id, account, status, canvas_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(teamId, channelId, rootTs, id, account, 'open', null, Date.now());
  return id;
}

/**
 * Record a handoff event. Returns how many handoffs this thread has seen.
 * @param {string} teamId
 * @param {{ threadId: string, fromId?: string | null, toId?: string | null, briefSent?: boolean }} input
 * @returns {number}
 */
export function recordHandoff(teamId, { threadId, fromId = null, toId = null, briefSent = true }) {
  db.prepare('INSERT INTO handoffs (id, team_id, thread_id, from_id, to_id, occurred_at, brief_sent) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), teamId, threadId, fromId, toId, Date.now(), briefSent ? 1 : 0);
  const row = db.prepare('SELECT COUNT(*) AS c FROM handoffs WHERE team_id = ? AND thread_id = ?').get(teamId, threadId);
  return /** @type {any} */ (row).c;
}

/**
 * @param {string} teamId
 * @param {string} channelId
 * @param {string} rootTs
 * @returns {any | null}
 */
export function getThreadBySlack(teamId, channelId, rootTs) {
  const r = /** @type {any} */ (
    db.prepare('SELECT * FROM threads WHERE team_id = ? AND channel_id = ? AND root_ts = ?').get(teamId, channelId, rootTs)
  );
  if (!r) return null;
  return { id: r.id, channelId: r.channel_id, rootTs: r.root_ts, account: r.account, status: r.status, canvasId: r.canvas_id, updatedAt: r.updated_at };
}

/**
 * Attach a canvas id to a thread (so later handoffs update the same canvas).
 * @param {string} teamId
 * @param {string} channelId
 * @param {string} rootTs
 * @param {string} canvasId
 * @returns {void}
 */
export function setThreadCanvasId(teamId, channelId, rootTs, canvasId) {
  db.prepare('UPDATE threads SET canvas_id = ? WHERE team_id = ? AND channel_id = ? AND root_ts = ?')
    .run(canvasId, teamId, channelId, rootTs);
}

/**
 * Credit a user with one handoff's worth of expertise in a topic.
 * @param {string} teamId
 * @param {{ userId: string, topic: string }} input
 * @returns {void}
 */
export function recordExpertise(teamId, { userId, topic }) {
  const t = normTopic(topic);
  if (!t || !userId) return;
  db.prepare(`INSERT INTO expertise (team_id, topic, user_id, count) VALUES (?, ?, ?, 1)
    ON CONFLICT (team_id, topic, user_id) DO UPDATE SET count = count + 1`).run(teamId, t, userId);
}

/**
 * How many times a user has been looped in on a topic.
 * @param {string} teamId
 * @param {string} topic
 * @param {string} userId
 * @returns {number}
 */
export function expertiseCount(teamId, topic, userId) {
  const r = db.prepare('SELECT count FROM expertise WHERE team_id = ? AND topic = ? AND user_id = ?').get(teamId, normTopic(topic), userId);
  return r ? /** @type {any} */ (r).count : 0;
}

/**
 * The user with the most handoffs in a topic, excluding some ids. Null if none.
 * @param {string} teamId
 * @param {string} topic
 * @param {(string | null | undefined)[]} [excludeIds]
 * @returns {{ userId: string, count: number } | null}
 */
export function topExpertForTopic(teamId, topic, excludeIds = []) {
  const rows = /** @type {any[]} */ (
    db.prepare('SELECT user_id, count FROM expertise WHERE team_id = ? AND topic = ? ORDER BY count DESC').all(teamId, normTopic(topic))
  );
  const ex = new Set(excludeIds);
  for (const row of rows) {
    if (ex.has(row.user_id)) continue;
    return { userId: row.user_id, count: row.count };
  }
  return null;
}

/**
 * Most recently active threads, newest first.
 * @param {string} teamId
 * @param {number} [limit]
 * @returns {any[]}
 */
export function recentThreads(teamId, limit = 10) {
  const rows = /** @type {any[]} */ (
    db.prepare('SELECT * FROM threads WHERE team_id = ? ORDER BY updated_at DESC LIMIT ?').all(teamId, limit)
  );
  return rows.map((r) => ({ id: r.id, channelId: r.channel_id, rootTs: r.root_ts, canvasId: r.canvas_id, updatedAt: r.updated_at }));
}

/**
 * All handoff events recorded for a thread, oldest first.
 * @param {string} teamId
 * @param {string} threadId
 * @returns {any[]}
 */
export function handoffsForThread(teamId, threadId) {
  const rows = /** @type {any[]} */ (
    db.prepare('SELECT * FROM handoffs WHERE team_id = ? AND thread_id = ? ORDER BY occurred_at ASC').all(teamId, threadId)
  );
  return rows.map((r) => ({ id: r.id, threadId: r.thread_id, fromId: r.from_id, toId: r.to_id, occurredAt: r.occurred_at, briefSent: !!r.brief_sent }));
}

/**
 * Per-topic expertise, each with experts sorted by count (desc). Topics with the
 * strongest expert come first.
 * @param {string} teamId
 * @returns {Array<{ topic: string, experts: Array<{ userId: string, count: number }> }>}
 */
export function expertiseSummary(teamId) {
  const rows = /** @type {any[]} */ (
    db.prepare('SELECT topic, user_id, count FROM expertise WHERE team_id = ? ORDER BY topic ASC, count DESC').all(teamId)
  );
  /** @type {Map<string, Array<{ userId: string, count: number }>>} */
  const byTopic = new Map();
  for (const r of rows) {
    if (!byTopic.has(r.topic)) byTopic.set(r.topic, []);
    byTopic.get(r.topic)?.push({ userId: r.user_id, count: r.count });
  }
  return [...byTopic.entries()]
    .map(([topic, experts]) => ({ topic, experts }))
    .sort((a, b) => (b.experts[0]?.count || 0) - (a.experts[0]?.count || 0));
}

/**
 * Most recently seen Salesforce cases, newest first.
 * @param {string} teamId
 * @param {number} [limit]
 * @returns {any[]}
 */
export function recentCases(teamId, limit = 5) {
  const rows = /** @type {any[]} */ (
    db.prepare('SELECT data FROM cases WHERE team_id = ? ORDER BY updated_at DESC LIMIT ?').all(teamId, limit)
  );
  return rows.map((r) => JSON.parse(r.data));
}

/**
 * Upsert a Salesforce case record (cached locally so we don't re-fetch).
 * @param {string} teamId
 * @param {string} caseNumber
 * @param {any} fields
 * @returns {any}
 */
export function upsertCase(teamId, caseNumber, fields) {
  const data = { caseNumber, ...fields, updatedAt: Date.now() };
  db.prepare(`INSERT INTO cases (team_id, case_number, data, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (team_id, case_number) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`)
    .run(teamId, caseNumber, JSON.stringify(data), data.updatedAt);
  return data;
}

/**
 * @param {string} teamId
 * @param {string} caseNumber
 * @returns {any | null}
 */
export function getCase(teamId, caseNumber) {
  const r = db.prepare('SELECT data FROM cases WHERE team_id = ? AND case_number = ?').get(teamId, caseNumber);
  return r ? JSON.parse(/** @type {any} */ (r).data) : null;
}

/**
 * Remove all of a team's Loop data (used on app uninstall).
 * @param {string} teamId
 * @returns {void}
 */
export function deleteTeamData(teamId) {
  for (const table of ['threads', 'handoffs', 'expertise', 'cases', 'sf_connections', 'user_memory', 'app_settings']) {
    db.prepare(`DELETE FROM ${table} WHERE team_id = ?`).run(teamId);
  }
}

// Per-user conversation memory: lets the bot recall a user's *own* prior chats
// across threads/restarts. Strictly scoped by (team_id, user_id) so one user's
// memory is never loaded for another. Content is encrypted at rest.
const MAX_USER_TURNS = 40; // keep ~20 recent exchanges per user

/**
 * Append one turn of a user's conversation with the bot, then prune to the most
 * recent MAX_USER_TURNS for that user.
 * @param {string} teamId
 * @param {string} userId
 * @param {'user' | 'assistant'} role
 * @param {string} content
 * @returns {void}
 */
export function recordUserTurn(teamId, userId, role, content) {
  if (!teamId || !userId || !content) return;
  db.prepare('INSERT INTO user_memory (id, team_id, user_id, role, content, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(randomUUID(), teamId, userId, role, encrypt(content), Date.now());
  db.prepare(
    `DELETE FROM user_memory WHERE team_id = ? AND user_id = ? AND id NOT IN (
       SELECT id FROM user_memory WHERE team_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?
     )`,
  ).run(teamId, userId, teamId, userId, MAX_USER_TURNS);
}

/**
 * A user's most recent turns with the bot, oldest-first. Only ever returns rows
 * for this exact (teamId, userId) — the isolation guarantee.
 * @param {string} teamId
 * @param {string} userId
 * @param {number} [limit]
 * @returns {Array<{ role: string, content: string, at: number }>}
 */
export function recentUserTurns(teamId, userId, limit = 12) {
  if (!teamId || !userId) return [];
  const rows = /** @type {any[]} */ (
    db.prepare('SELECT role, content, created_at FROM user_memory WHERE team_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?')
      .all(teamId, userId, limit)
  );
  return rows.reverse().map((r) => ({ role: r.role, content: decrypt(r.content), at: r.created_at }));
}

/**
 * Forget a user's stored conversation memory (e.g. a "forget me" request).
 * @param {string} teamId
 * @param {string} userId
 * @returns {void}
 */
export function deleteUserMemory(teamId, userId) {
  db.prepare('DELETE FROM user_memory WHERE team_id = ? AND user_id = ?').run(teamId, userId);
}

/**
 * Store/replace a team's Salesforce connection (secrets encrypted at rest).
 * @param {string} teamId
 * @param {{ mcpUrl?: string|null, loginUrl?: string|null, clientId?: string|null, refreshToken?: string|null, clientSecret?: string|null }} c
 * @returns {void}
 */
export function setSfConnection(teamId, { mcpUrl, loginUrl, clientId, refreshToken, clientSecret }) {
  db.prepare(
    `INSERT INTO sf_connections (team_id, mcp_url, login_url, client_id, refresh_token_enc, client_secret_enc, connected_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET mcp_url = excluded.mcp_url, login_url = excluded.login_url,
       client_id = excluded.client_id, refresh_token_enc = COALESCE(excluded.refresh_token_enc, sf_connections.refresh_token_enc),
       client_secret_enc = COALESCE(excluded.client_secret_enc, sf_connections.client_secret_enc), connected_at = excluded.connected_at`,
  ).run(
    teamId,
    mcpUrl || null,
    loginUrl || null,
    clientId || null,
    refreshToken ? encrypt(refreshToken) : null,
    clientSecret ? encrypt(clientSecret) : null,
    Date.now(),
  );
}

/**
 * @param {string} teamId
 * @returns {{ mcpUrl: string|null, loginUrl: string|null, clientId: string|null, refreshToken: string|null, clientSecret: string|null, connectedAt: number } | null}
 */
export function getSfConnection(teamId) {
  const r = /** @type {any} */ (db.prepare('SELECT * FROM sf_connections WHERE team_id = ?').get(teamId));
  if (!r) return null;
  return {
    mcpUrl: r.mcp_url,
    loginUrl: r.login_url,
    clientId: r.client_id,
    refreshToken: r.refresh_token_enc ? decrypt(r.refresh_token_enc) : null,
    clientSecret: r.client_secret_enc ? decrypt(r.client_secret_enc) : null,
    connectedAt: r.connected_at,
  };
}

/**
 * @param {string} teamId
 * @returns {void}
 */
export function deleteSfConnection(teamId) {
  db.prepare('DELETE FROM sf_connections WHERE team_id = ?').run(teamId);
}

/**
 * Store/replace a team's app settings (the Anthropic API key, encrypted).
 * @param {string} teamId
 * @param {{ anthropicKey?: string | null }} settings
 * @returns {void}
 */
export function setAppSettings(teamId, { anthropicKey }) {
  db.prepare(
    `INSERT INTO app_settings (team_id, anthropic_key_enc, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(team_id) DO UPDATE SET
       anthropic_key_enc = COALESCE(excluded.anthropic_key_enc, app_settings.anthropic_key_enc),
       updated_at = excluded.updated_at`,
  ).run(teamId, anthropicKey ? encrypt(anthropicKey) : null, Date.now());
}

/**
 * @param {string} teamId
 * @returns {{ anthropicKey: string | null } | null}
 */
export function getAppSettings(teamId) {
  if (!teamId) return null;
  const r = /** @type {any} */ (db.prepare('SELECT anthropic_key_enc FROM app_settings WHERE team_id = ?').get(teamId));
  if (!r) return null;
  return { anthropicKey: r.anthropic_key_enc ? decrypt(r.anthropic_key_enc) : null };
}
