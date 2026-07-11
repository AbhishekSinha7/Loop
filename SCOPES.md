# Loop — Slack scope justification

For Marketplace review. Loop reads customer threads with the **bot** token and uses the
**user** token only for the Slack MCP server (workspace search + canvases).

## Bot token scopes

| Scope | Why Loop needs it |
|---|---|
| `app_mentions:read` | Receive @mentions to run the assistant |
| `channels:history`, `groups:history` | Read the thread on handoff (`conversations.replies`) in public/private channels |
| `im:history` | Handle DMs to the assistant |
| `im:read`, `im:write` | Open + post the brief DM to the looped-in person |
| `chat:write` | Post briefs, routing nudges, slash-command responses |
| `users:read` | Resolve display names for the brief |
| `reactions:write` | Assistant emoji acknowledgements |
| `assistant:write` | Assistant (App Home / assistant thread) features |
| `commands` | `/customer-history` slash command |

## User token scopes (Slack MCP: search + canvases)

| Scope | Why Loop needs it |
|---|---|
| `search:read.public`, `search:read.private` | "Seen before" — search prior customer threads across public/private channels |
| `channels:history`, `groups:history`, `channels:read`, `groups:read` | Let the MCP read/resolve found channel threads |
| `im:history`, `mpim:history`, `search:read.im`, `search:read.mpim`, `search:read.users` | DM/group-DM/user search context for the MCP — **trim candidates** (see below) |
| `canvases:read`, `canvases:write` | Create/update the per-thread customer dossier canvas |
| `users:read` | Resolve users in search results / canvases |

## Removed as unused

- **bot** `reactions:read` — Loop only *adds* reactions, never reads them.
- **user** `users:read.email` — Loop never accesses email addresses.
- **user** `search:read.files` — Loop searches *messages*, not files.
- **user** `search:read` — not supported for Slack Marketplace apps; the granular
  `search:read.public` / `.private` / `.im` / `.mpim` / `.users` scopes cover search.

## Further-trim candidates (test first)

The user token backs the **hosted Slack MCP server**, so removing a search scope can silently
reduce what "seen before" finds. These look unused by Loop's channel-thread search and are
candidates to drop: `im:history`, `mpim:history`, `search:read.im`, `search:read.mpim`,
`search:read.users`, and the user `chat:write` (Loop posts as the bot, not the user).

## After changing any scope

Scope changes require **reinstalling** the app and **re-minting** the User OAuth Token. Then
re-run `node scripts/slack-check.js` and `node scripts/related-check.js` to confirm search still works.

---

## Marketplace form — copy-paste scope reasons (each ≥ 75 characters)

Paste one into each scope's "reason" field on the Slack Marketplace submission.

### Bot token scopes

- **app_mentions:read** — Loop listens for @mentions of the bot so a user can invoke the assistant directly in a channel and get a helpful reply back in the same thread.
- **channels:history** — When a customer thread in a public channel is handed off, Loop reads that thread's messages (conversations.replies) to synthesize the handoff brief.
- **groups:history** — Same as channels:history but for private channels: Loop reads the handed-off thread's messages there to build the brief for the person looped in.
- **im:history** — Loop reads direct messages sent to the assistant so it can answer follow-up questions and continue the conversation with the user with full context.
- **im:read** — Loop opens and identifies the direct-message channel with a looped-in teammate so it can privately deliver the handoff brief to exactly that person.
- **im:write** — Loop opens a DM and posts the handoff brief to whoever was looped into a customer thread, and replies to users who message the assistant directly.
- **chat:write** — Loop posts handoff briefs, routing nudges, drafted replies, and slash-command responses, and posts messages into channel threads when a user asks it to.
- **reactions:write** — The assistant adds a single emoji reaction to acknowledge a user's message before it replies, giving lightweight, human-like confirmation of receipt.
- **users:read** — Loop resolves user IDs to display names so briefs and dashboards read naturally (for example "looped in: Sameed") instead of showing raw internal user IDs.
- **assistant:write** — Loop uses Slack's assistant/agent surface (App Home assistant thread, suggested prompts, and thinking status) to deliver its conversational assistant experience.
- **commands** — Loop registers the /customer-history and /forget-me slash commands so users can review recent customer threads and erase their own stored conversation memory.

### User token scopes (power the Slack MCP server: workspace search + canvases)

- **search:read.public** — Loop searches public channels through the Slack MCP server to surface prior related customer threads for the "seen this before" section of each handoff brief.
- **search:read.private** — Loop searches private channels the user belongs to, to find prior related customer threads for the "seen this before" section of the handoff brief.
- **search:read.im** — Loop searches direct messages the user is part of so the "seen before" feature can include relevant prior one-on-one discussions about the customer or issue.
- **search:read.mpim** — Loop searches group direct messages the user is part of so the "seen before" feature can include relevant prior discussions held in group DMs.
- **search:read.users** — Loop searches for users so workspace search can attribute prior related discussions to the correct people when building the "seen before" summary in a brief.
- **channels:history** — The Slack MCP server reads found public-channel threads on the user's behalf to extract the context that becomes the "seen before" summary in the brief.
- **groups:history** — The Slack MCP server reads found private-channel threads on the user's behalf to build the "seen before" summary, the same purpose as public channels:history.
- **im:history** — Included so the Slack MCP search can consider relevant direct-message context when locating prior related discussions to include in the handoff brief.
- **mpim:history** — Included so the Slack MCP search can consider relevant group-DM context when locating prior related customer discussions to include in the handoff brief.
- **channels:read** — Loop resolves public channels returned by search (names and IDs) so "seen before" results and canvas references point to the correct conversations for the user.
- **groups:read** — Loop resolves private channels returned by search so "seen before" results and canvas links reference the correct private conversations accurately for the user.
- **users:read** — Loop resolves user IDs to display names in search results and in the customer canvas so briefs and dossiers show readable names instead of raw internal IDs.
- **canvases:read** — Loop reads the per-thread customer "dossier" canvas so it can update the existing canvas as the conversation evolves instead of creating duplicate documents.
- **canvases:write** — Loop creates and updates a per-thread customer "dossier" canvas summarizing the issue, Salesforce case, and history for everyone working the thread.
- **chat:write** — Grants the Slack MCP server permission to send or draft a message on the user's behalf when the assistant is explicitly asked to take that Slack action for them.
