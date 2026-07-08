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
| `search:read`, `search:read.public`, `search:read.private` | "Seen before" — search prior customer threads across channels |
| `channels:history`, `groups:history`, `channels:read`, `groups:read` | Let the MCP read/resolve found channel threads |
| `im:history`, `mpim:history`, `search:read.im`, `search:read.mpim`, `search:read.users` | DM/group-DM/user search context for the MCP — **trim candidates** (see below) |
| `canvases:read`, `canvases:write` | Create/update the per-thread customer dossier canvas |
| `users:read` | Resolve users in search results / canvases |

## Removed as unused

- **bot** `reactions:read` — Loop only *adds* reactions, never reads them.
- **user** `users:read.email` — Loop never accesses email addresses.
- **user** `search:read.files` — Loop searches *messages*, not files.

## Further-trim candidates (test first)

The user token backs the **hosted Slack MCP server**, so removing a search scope can silently
reduce what "seen before" finds. These look unused by Loop's channel-thread search and are
candidates to drop: `im:history`, `mpim:history`, `search:read.im`, `search:read.mpim`,
`search:read.users`, and the user `chat:write` (Loop posts as the bot, not the user).

## After changing any scope

Scope changes require **reinstalling** the app and **re-minting** the User OAuth Token. Then
re-run `node scripts/slack-check.js` and `node scripts/related-check.js` to confirm search still works.
