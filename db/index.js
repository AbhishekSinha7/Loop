import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'loop-data.json');

/** @type {{ threads: Record<string, any>, handoffs: any[] }} */
let data = { threads: {}, handoffs: [] };

(function load() {
  if (existsSync(DB_PATH)) {
    try {
      data = JSON.parse(readFileSync(DB_PATH, 'utf8'));
    } catch {
      /* corrupt/empty file — start fresh */
    }
  }
  data.threads ||= {};
  data.handoffs ||= [];
})();

function save() {
  writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

const key = (channelId, rootTs) => `${channelId}:${rootTs}`;

/**
 * Insert the thread if new, else touch it. Returns the stable thread id.
 * @param {{ channelId: string, rootTs: string, account?: string | null }} input
 * @returns {string}
 */
export function upsertThread({ channelId, rootTs, account = null }) {
  const k = key(channelId, rootTs);
  let t = data.threads[k];
  if (!t) {
    t = {
      id: randomUUID(),
      channelId, rootTs, account,
      status: 'open',
      issue: null, attempted: null, pendingQ: null,
      topicId: null, ownerId: null, caseId: null,
      updatedAt: Date.now(),
    };
    data.threads[k] = t;
  } else {
    t.updatedAt = Date.now();
    if (account && !t.account) t.account = account;
  }
  save();
  return t.id;
}

/**
 * Record a handoff event. Returns how many handoffs this thread has seen.
 * @param {{ threadId: string, fromId?: string | null, toId?: string | null, briefSent?: boolean }} input
 * @returns {number}
 */
export function recordHandoff({ threadId, fromId = null, toId = null, briefSent = true }) {
  data.handoffs.push({ id: randomUUID(), threadId, fromId, toId, occurredAt: Date.now(), briefSent });
  save();
  return data.handoffs.filter((h) => h.threadId === threadId).length;
}

/**
 * @param {string} channelId
 * @param {string} rootTs
 * @returns {any | null}
 */
export function getThreadBySlack(channelId, rootTs) {
  return data.threads[key(channelId, rootTs)] || null;
}