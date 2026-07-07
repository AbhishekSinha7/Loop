import Anthropic from '@anthropic-ai/sdk';
import { getAppSettings } from '../db/index.js';

// Per-team Anthropic client. Each installing org provides its own API key via
// the Slack Settings modal (stored encrypted); we resolve and memoize a client
// per key. Falls back to the ANTHROPIC_API_KEY env var (single-tenant dev).

/** @type {Map<string, import('@anthropic-ai/sdk').Anthropic>} */
const clients = new Map();

/**
 * The Anthropic API key for a team: the team's own key, else the env fallback.
 * @param {string} [teamId]
 * @returns {string | undefined}
 */
export function getTeamApiKey(teamId) {
  const teamKey = teamId ? getAppSettings(teamId)?.anthropicKey : null;
  return teamKey || process.env.ANTHROPIC_API_KEY || undefined;
}

/**
 * An Anthropic client scoped to a team's API key (memoized by key).
 * @param {string} [teamId]
 * @returns {import('@anthropic-ai/sdk').Anthropic}
 */
export function getAnthropic(teamId) {
  const key = getTeamApiKey(teamId);
  const cacheKey = key || '__env__';
  let client = clients.get(cacheKey);
  if (!client) {
    client = key ? new Anthropic({ apiKey: key }) : new Anthropic();
    clients.set(cacheKey, client);
  }
  return client;
}
