import { WebClient } from '@slack/web-api';

/** Cache auth.test (team url) per user token. @type {Map<string, any>} */
const authCache = new Map();

/**
 * @param {string | undefined} token
 * @returns {WebClient | null}
 */
function getWeb(token) {
  return token ? new WebClient(token) : null;
}

/**
 * Best-effort shareable link to a canvas (canvases.create returns only an id).
 * @param {string | undefined} token
 * @param {string} canvasId
 * @returns {Promise<string | null>}
 */
async function canvasLink(token, canvasId) {
  const w = getWeb(token);
  if (!w || !token) return null;
  try {
    let info = authCache.get(token);
    if (!info) {
      info = await w.auth.test();
      authCache.set(token, info);
    }
    const base = String(info.url || '').replace(/\/$/, '');
    return base && info.team_id ? `${base}/docs/${info.team_id}/${canvasId}` : null;
  } catch {
    return null;
  }
}

/**
 * @param {{ channelId: string, summary: any, caseContext: any, related: any, handoffCount: number, loopedIn: string[] }} d
 * @returns {string}
 */
function buildDossier({ channelId, summary, caseContext, related, handoffCount, loopedIn }) {
  const lines = [`Customer thread in <#${channelId}>`, ''];
  if (summary) {
    lines.push('## Issue', summary.issue, '', '## Tried so far', summary.tried, '', '## Open question', summary.pending, '');
  }
  if (caseContext) {
    lines.push(
      '## Salesforce',
      `Case ${caseContext.caseNumber} — ${caseContext.accountName} (${caseContext.accountTier})`,
      `Status: ${caseContext.status} · ${caseContext.priorCases} prior case(s)`,
    );
    if (caseContext.recentActivity) lines.push(`Latest: ${caseContext.recentActivity}`);
    lines.push('');
  }
  if (related?.summary) lines.push('## Seen before', related.summary, '');
  lines.push('## Handoffs', `Handed off ${handoffCount}× · latest: ${loopedIn.map((u) => `<@${u}>`).join(', ') || '—'}`);
  return lines.join('\n');
}

/**
 * Create or update the per-thread customer dossier canvas using the installing
 * team's Slack user token (canvases:write). Returns the canvas id + a best-effort
 * link, or null if no token / on failure.
 * @param {{ channelId: string, existingCanvasId?: string | null, summary: any, caseContext: any, related: any, handoffCount: number, loopedIn: string[], userToken?: string | undefined }} input
 * @returns {Promise<{ canvasId: string, link: string | null } | null>}
 */
export async function syncThreadCanvas({ channelId, existingCanvasId = null, summary, caseContext, related, handoffCount, loopedIn, userToken }) {
  const w = getWeb(userToken);
  if (!w) return null;

  const markdown = buildDossier({ channelId, summary, caseContext, related, handoffCount, loopedIn });

  try {
    if (existingCanvasId) {
      await w.canvases.edit({
        canvas_id: existingCanvasId,
        changes: [{ operation: 'replace', document_content: { type: 'markdown', markdown } }],
      });
      return { canvasId: existingCanvasId, link: await canvasLink(userToken, existingCanvasId) };
    }
    const res = await w.canvases.create({
      title: 'Loop — customer dossier',
      channel_id: channelId,
      document_content: { type: 'markdown', markdown },
    });
    const canvasId = /** @type {any} */ (res).canvas_id;
    if (!canvasId) return null;
    return { canvasId, link: await canvasLink(userToken, canvasId) };
  } catch {
    return null;
  }
}
