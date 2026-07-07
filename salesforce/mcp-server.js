import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import { getSalesforceCase } from './get-case.js';

/**
 * In-process MCP server exposing Salesforce case lookup. This is the project's
 * "MCP" required-technology surface for Salesforce — it wraps the same
 * `getSalesforceCase` source the handoff brief uses, so wiring it to a live
 * Salesforce org (in get-case.js) lights up both surfaces at once.
 * @returns {import('@anthropic-ai/claude-agent-sdk').McpSdkServerConfigWithInstance}
 */
export function createSalesforceMcpServer(/** @type {string=} */ teamId) {
  const getCaseTool = tool(
    'get_salesforce_case',
    'Look up Salesforce case context (status, account tier, prior cases) by case number.',
    { case_number: z.string().describe('The Salesforce case number, e.g. 00012345') },
    async ({ case_number }) => {
      const c = await getSalesforceCase(/** @type {string} */ (teamId), case_number);
      if (!c) {
        return { content: [{ type: 'text', text: `No Salesforce case found for ${case_number}.` }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify(c) }] };
    },
  );

  return createSdkMcpServer({ name: 'salesforce', version: '1.0.0', tools: [getCaseTool] });
}
