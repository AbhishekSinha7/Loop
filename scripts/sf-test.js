// Test the live Salesforce path in isolation (no Slack needed).
//   node scripts/sf-test.js <CASE_NUMBER>     # a real case # from your org
import 'dotenv/config';
import { getAccessToken } from '../salesforce/sf-token.js';
import { getSalesforceCase, parseCaseRef } from '../salesforce/get-case.js';

const ref = process.argv[2];
const teamId = process.argv[3] || 'DEV';

console.log('Config:');
console.log('  SALESFORCE_MCP_URL      :', process.env.SALESFORCE_MCP_URL || '(unset -> mock mode)');
console.log('  SALESFORCE_LOGIN_URL    :', process.env.SALESFORCE_LOGIN_URL || '(default login.salesforce.com)');
console.log('  SALESFORCE_CLIENT_ID    :', process.env.SALESFORCE_CLIENT_ID ? 'set' : '(unset)');
console.log('  SALESFORCE_REFRESH_TOKEN:', process.env.SALESFORCE_REFRESH_TOKEN ? 'set' : '(unset)');
console.log('  SALESFORCE_MCP_TOKEN    :', process.env.SALESFORCE_MCP_TOKEN ? 'set (manual override)' : '(unset)');

if (!ref) {
  console.log('\nUsage: node scripts/sf-test.js <CASE_NUMBER> [TEAM_ID]   (a real case # from your org)');
  process.exit(1);
}

console.log('\n1) Token check ...');
try {
  const tok = await getAccessToken();
  console.log('   getAccessToken ->', tok ? `ok (length ${tok.length})` : 'null (no creds; would use mock)');
} catch (e) {
  console.error('   token refresh FAILED:', e.message);
  console.error('   -> re-run scripts/sf-mcp-login.js, or check SALESFORCE_CLIENT_ID / refresh token / login URL.');
  process.exit(1);
}

console.log(`\n2) Case lookup for "${ref}" (parsed: ${parseCaseRef(ref) || ref}) ...`);
try {
  const c = await getSalesforceCase(teamId, ref);
  if (!c) {
    console.log('   -> null (case not found, or the server returned nothing)');
  } else {
    console.log('  ', JSON.stringify(c, null, 2));
    console.log(c.mock ? '   (MOCK — SALESFORCE_MCP_URL not set)' : '   ✅ LIVE data from Salesforce');
  }
} catch (e) {
  console.error('   lookup FAILED:', e.message);
  console.error('   -> check SALESFORCE_MCP_URL is the Streamable-HTTP endpoint and the token has the mcp_api scope.');
  process.exit(1);
}
