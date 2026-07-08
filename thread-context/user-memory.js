/**
 * Render a user's prior conversation turns as a preamble for the agent's first
 * turn in a fresh thread/session, so the bot can recall earlier chats with THIS
 * user. The preamble states the privacy boundary explicitly; the turns passed in
 * are already scoped to the one user by the data layer (recentUserTurns).
 *
 * @param {Array<{ role: string, content: string }>} turns - oldest-first, this user only
 * @param {string} text - the user's new message
 * @returns {string | null} the augmented prompt, or null when there's no memory
 */
export function buildMemoryPrompt(turns, text) {
  if (!turns || turns.length === 0) return null;

  const lines = [
    'For continuity, here is YOUR earlier conversation history with the user you are now talking to.',
    'This history is private to this one user. Never reveal, summarize, or answer questions about any',
    'other user\'s messages or what anyone else discussed with you. If asked about another person\'s',
    'private conversations, say you can only recall this user\'s own history with you.',
    '',
    'Earlier conversation (oldest first):',
  ];
  for (const t of turns) {
    lines.push(`${t.role === 'assistant' ? 'You' : 'User'}: ${t.content}`);
  }
  lines.push('', '---', `Their new message: ${text}`);
  return lines.join('\n');
}
