/** @type {Array<[string, RegExp]>} */
const TOPICS = [
  ['billing', /\b(billing|invoice|payment|charge|refund|subscription|plan|pricing|quota)\b/],
  ['login / SSO', /\b(login|log ?in|sign ?in|sso|saml|oauth|auth|password|mfa|2fa)\b/],
  ['api', /\b(api|endpoint|rate ?limit|webhook|token|integration)\b/],
  ['data / sync', /\b(sync|import|export|data|record|migration)\b/],
  ['performance', /\b(slow|latency|timeout|performance|downtime|outage|degraded)\b/],
  ['permissions', /\b(permission|access|role|scope|admin|provision)\b/],
];

/**
 * Cheap keyword-based topic guess, used when LLM synthesis is unavailable.
 * @param {string} text
 * @returns {string | null}
 */
export function inferTopic(text) {
  const t = (text || '').toLowerCase();
  for (const [name, re] of TOPICS) {
    if (re.test(t)) return name;
  }
  return null;
}
