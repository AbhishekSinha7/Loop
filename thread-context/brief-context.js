/**
 * @typedef {Object} BriefContext
 * @property {string} customerChannelId - the channel the handoff happened in
 * @property {string} [rootTs] - the customer thread's root timestamp
 * @property {string} transcript
 * @property {{ issue: string, tried: string, pending: string } | null} [summary]
 * @property {{ caseNumber: string, status: string, accountName: string, accountTier: string, priorCases: number, recentActivity?: string } | null} [caseContext]
 * @property {{ summary: string } | null} [related]
 * @property {string | null} [topic]
 */

/**
 * @typedef {Object} BriefEntry
 * @property {BriefContext} context
 * @property {number} timestamp
 */

/**
 * In-memory store of handoff-brief context, keyed by the brief's DM channel, so a
 * follow-up reply in that DM can be answered with the full handoff context. TTL-based.
 */
export class BriefContextStore {
  /**
   * @param {number} [ttlSeconds=43200] - default 12h
   * @param {number} [maxEntries=1000]
   */
  constructor(ttlSeconds = 43200, maxEntries = 1000) {
    /** @private @type {Map<string, BriefEntry>} */
    this._store = new Map();
    /** @private @type {number} */
    this._ttlSeconds = ttlSeconds;
    /** @private @type {number} */
    this._maxEntries = maxEntries;
  }

  /**
   * @param {string} dmChannel
   * @param {BriefContext} context
   * @returns {void}
   */
  set(dmChannel, context) {
    this._store.set(dmChannel, { context, timestamp: Date.now() });
    this._cleanup();
  }

  /**
   * @param {string} dmChannel
   * @returns {BriefContext | null}
   */
  get(dmChannel) {
    const entry = this._store.get(dmChannel);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this._ttlSeconds * 1000) {
      this._store.delete(dmChannel);
      return null;
    }
    return entry.context;
  }

  /**
   * @param {string} dmChannel
   * @returns {void}
   */
  delete(dmChannel) {
    this._store.delete(dmChannel);
  }

  /**
   * @private
   * @returns {void}
   */
  _cleanup() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now - entry.timestamp > this._ttlSeconds * 1000) this._store.delete(key);
    }
    if (this._store.size > this._maxEntries) {
      const sorted = [...this._store.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (const [key] of sorted.slice(0, this._store.size - this._maxEntries)) this._store.delete(key);
    }
  }
}

/**
 * Render stored brief context as a preamble for the agent's first follow-up turn.
 * @param {BriefContext} ctx
 * @param {string} followup - the user's follow-up message
 * @returns {string}
 */
export function buildFollowupPrompt(ctx, followup) {
  const lines = [
    'You earlier sent this user a handoff brief: they were looped into a customer support',
    'conversation. Use the context below to answer their follow-up. You may use your Slack and',
    'Salesforce tools to dig deeper. Do not say you lack context — it is provided here.',
    '',
    `Customer thread: <#${ctx.customerChannelId}>`,
  ];
  if (ctx.summary) {
    lines.push(`Issue: ${ctx.summary.issue}`, `Tried so far: ${ctx.summary.tried}`, `Open question: ${ctx.summary.pending}`);
  }
  if (ctx.topic) lines.push(`Topic: ${ctx.topic}`);
  if (ctx.caseContext) {
    const c = ctx.caseContext;
    lines.push(
      `Salesforce: Case ${c.caseNumber} — ${c.accountName} (${c.accountTier}), status ${c.status}, ${c.priorCases} prior case(s).${c.recentActivity ? ` Latest: ${c.recentActivity}` : ''}`,
    );
  }
  if (ctx.related?.summary) lines.push(`Seen before: ${ctx.related.summary}`);
  lines.push('', 'Full thread transcript:', ctx.transcript, '', '---', `Their follow-up: ${followup}`);
  return lines.join('\n');
}
