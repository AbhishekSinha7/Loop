# Loop (Customer Whisperer) — Architecture & Developer Guide

Loop is an **ambient Slack agent** for customer-facing teams. It watches customer threads and,
the moment someone is handed a conversation ("@maria can you take this?"), it DMs that person a
ready-to-act **brief**: what the issue is, what's been tried, the live **Salesforce** case, prior
**"seen this before"** threads from your workspace, a routing nudge to the strongest expert, and a
link to a living **canvas dossier** — all before they ask "can you catch me up?".

It is built on **Bolt for JavaScript**, **Claude (Opus 4.8)** via the Anthropic SDK, and the **MCP
connector** (Salesforce + Slack hosted MCP servers). It ships as a **multi-tenant** app any
workspace can install via OAuth, with all data and credentials isolated per Slack team.

> This document is the engineering reference. For other docs: [README.md](README.md) (upstream
> starter setup), [DEPLOY.md](DEPLOY.md) (production hosting), [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md)
> (connecting a Salesforce org), [SCOPES.md](SCOPES.md) (scope justification), [TESTING.md](TESTING.md).

---

## 1. What it does (entry points)

| Trigger | Handler | Result |
|---|---|---|
| A handoff message in a channel (`@user can you take this?`) | [handoff.js](listeners/events/handoff.js) | The **core feature** — DMs the looped-in person a brief; updates the canvas; learns expertise |
| DM to the agent / @mention | [message.js](listeners/events/message.js), [app-mentioned.js](listeners/events/app-mentioned.js) | Conversational Claude agent (with Slack + Salesforce MCP tools), with per-user memory recall |
| `/customer-history` | [customer-history.js](listeners/commands/customer-history.js) | Lists recent customer threads + handoffs |
| `/forget-me` | [forget-me.js](listeners/commands/forget-me.js) | Erases the caller's own stored conversation memory |
| Opening the app's **Home** tab | [app-home-opened.js](listeners/events/app-home-opened.js) | Dashboard: active threads, "who knows what", recent cases, Salesforce connect |
| Assistant panel opened | [assistant-thread-started.js](listeners/events/assistant-thread-started.js) | Sets suggested prompts |

---

## 2. The handoff pipeline (the heart of Loop)

When a `message` event arrives, [handoff.js](listeners/events/handoff.js) runs this funnel —
cheap checks first, expensive ones only if they pass:

```
message event
  ├─ skip bots / DMs / no @mentions
  ├─ looksLikeHandoff(text)         ── regex gate (agent/.. inline) — free
  ├─ classifyHandoff(text)          ── Claude YES/NO, 8s budget, heuristic fallback
  │     ↓ (confirmed handoff)
  ├─ conversations.replies          ── pull the thread transcript
  ├─ resolve display names (users.info)
  ├─ parseCaseRef(transcript)       ── find a Salesforce case # if present
  │
  ├─ Promise.all([                  ── enrich in parallel:
  │     synthesizeBrief(transcript)        Claude → {issue, tried, pending, topic}
  │     getSalesforceCase(teamId, caseRef) live SF case + recent activity (MCP)
  │     searchRelatedHistory(transcript)   Slack MCP search → "seen before"
  │   ])
  │
  ├─ syncThreadCanvas(...)          ── create/update the per-thread dossier canvas
  └─ for each looped-in user:
        recordHandoff + recordExpertise        learn who handles what
        topExpertForTopic                       is there a stronger expert?
        buildBrief(...)                          render Block Kit brief
        conversations.open + chat.postMessage   DM the brief
```

**Design principle: graceful degradation.** Every enrichment step is wrapped in `.catch()` and has
a fallback — no API key → heuristic classifier + raw-transcript brief; no Salesforce → mock case;
no user token → no search/canvas. The brief always sends.

### Follow-ups (the brief is interrogatable)

The brief is a DM, so the looped-in person can just **reply** to it. When that happens:

- The reply is an `im` message → [handoff.js](listeners/events/handoff.js) bails (it never re-briefs
  on DMs), and [message.js](listeners/events/message.js) handles it via the conversational agent.
- To stop the agent answering **cold**, each brief seeds a [BriefContextStore](thread-context/brief-context.js)
  entry keyed by the **DM channel** (issue/tried/open + Salesforce case + "seen before" + full
  transcript). On the first follow-up with no live session, `buildFollowupPrompt` injects that
  context into the agent's first turn; subsequent turns resume the Claude session normally.
- The agent still has its Slack + Salesforce MCP tools, so a follow-up like *"who closed the last
  Acme case?"* can dig further from the briefed context.

Notes: context is per-**handoff** (a newer brief in the same DM overwrites the prior one, latest
wins; TTL 12h). Top-level DM replies re-inject context (each gets a fresh `thread_ts` → no session
yet); threaded replies resume the session cleanly.

### Auto-draft reply (on-demand)

Every brief carries a **✍️ Draft a reply** button ([build-brief.js](brief/build-brief.js)) — kept
on-demand so it adds **no latency** to the handoff. On click, [draft-reply.js](listeners/actions/draft-reply.js)
pulls the stored brief context (transcript + Salesforce + "seen before") and asks Claude
([agent/draft-reply.js](agent/draft-reply.js)) for a concise, customer-ready reply grounded only in
that context. The draft is shown back in the DM with **📨 Post to thread** (posts it into the customer
thread) and **🔁 Regenerate**. If the draft is too long to carry in a button value, the post button is
omitted and the agent says to copy it manually.

---

## 3. Three required technologies (challenge surfaces)

1. **Claude (Opus 4.8) via `@anthropic-ai/sdk`** — `classifyHandoff`, `synthesizeBrief`,
   `inferTopic` fallback. Direct `messages.create` with tight per-call timeouts and `maxRetries: 0`
   so a slow model never blocks a handoff.
2. **MCP connector (`mcp-client-2025-11-20` beta)** — `beta.messages.stream` with `mcp_servers` +
   `mcp_toolset`, used twice: **Salesforce** hosted MCP ([get-case.js](salesforce/get-case.js)) and
   **Slack** hosted MCP ([related-history.js](agent/related-history.js)). Streamed so the long
   server-side tool loop keeps the connection alive instead of timing out.
3. **Bolt for JavaScript** — events, actions, views, commands, OAuth install store, custom HTTP routes.

The conversational agent ([agent.js](agent/agent.js)) additionally uses the **Claude Agent SDK**
(`query` + `createSdkMcpServer`) with an in-process emoji tool and an in-process Salesforce MCP server.

---

## 4. Multi-tenancy model

**Everything is keyed by the Slack `team_id`.** One principle drives the whole design:

- **Install tokens** → Bolt `InstallationStore` ([installation-store.js](db/installation-store.js)),
  encrypted at rest, keyed `T:<teamId>` (or `E:<enterpriseId>` for org installs).
- **Loop data** (threads, handoffs, expertise, cases) → every table has a `team_id` column; every
  query filters by it. Team T2 can never see team T1's rows.
- **Slack user token** → taken from the install (`context.userToken`), not env — each workspace's
  search/canvas runs as its own user.
- **Salesforce** → per-team `sf_connections` row (encrypted refresh token), set up via the in-app
  Connect flow. A team with no connection falls back to mock data.
- **Anthropic API key** → per-team `app_settings` row (encrypted), entered in the App Home **Settings**
  modal. [agent/anthropic.js](agent/anthropic.js) builds a Claude client per team key; the Agent SDK
  conversational path gets it via `Options.env`. Falls back to the `ANTHROPIC_API_KEY` env var for
  single-tenant/dev. So each org runs Claude on its **own** key and bill.
- **Uninstall** → `deleteInstallation` purges the install **and** calls `deleteTeamData(teamId)`.

Two run modes share all the same listeners:
- **`app.js`** — Socket Mode (`slack run` / `npm start`), single workspace, dev.
- **`app-oauth.js`** — HTTP + OAuth, multi-tenant, production (`npm run start:oauth`).

### Per-user conversation memory (cross-conversation recall, isolated)

Beyond the in-thread Claude session, the bot has **durable memory of each user's own chats** — so it
remembers past conversations across threads and restarts. Each exchange is stored in `user_memory`
([db/index.js](db/index.js)) keyed by **`team_id` + `user_id`**, encrypted at rest, capped at ~20
recent exchanges. On a cold conversation, [message.js](listeners/events/message.js) /
[app-mentioned.js](listeners/events/app-mentioned.js) recall that user's turns via
[buildMemoryPrompt](thread-context/user-memory.js) and seed the agent's first turn (a handoff-brief
follow-up takes precedence in DMs).

**"Never other users" is enforced structurally, not just by prompt:** recall queries only
`WHERE team_id = ? AND user_id = ?`, so the agent is never *given* another user's data and cannot
reveal what it doesn't hold (proven in [tests/db/user-memory.test.js](tests/db/user-memory.test.js)).
A `## PRIVACY` clause in the agent prompt is defense-in-depth. Note this is distinct from the Slack
MCP search tool, which legitimately searches **public** channels.

**Lifecycle:** `/forget-me` ([forget-me.js](listeners/commands/forget-me.js)) erases the caller's
memory; uninstall purges the whole team's via `deleteTeamData`. The privacy trade-off is that chat
content is stored at rest — encrypted with `TOKEN_ENC_KEY`.

---

## 5. Data layer (libSQL / Turso)

Loop uses **libSQL** (SQLite) via `@libsql/client`: a **local file** in dev (`loop.db`, path via
`LOOP_DB_PATH`) and **Turso** (hosted libSQL, free tier) in production when `TURSO_DATABASE_URL` is set —
so data persists on any host with no DB server to run. All [db/index.js](db/index.js) functions are
**async** and take `teamId` as the first argument; the schema is created once on import via top-level
`await`.

| Table | Primary key | Holds |
|---|---|---|
| `threads` | `team_id, channel_id, root_ts` | One row per customer thread (+ its canvas id) |
| `handoffs` | `id` | Each handoff event (from → to, when) |
| `expertise` | `team_id, topic, user_id` | Running count of how often a user is looped in per topic |
| `cases` | `team_id, case_number` | Cached Salesforce case JSON (5-min TTL) |
| `installations` | `install_key` | Encrypted Bolt installation (bot/user tokens) |
| `sf_connections` | `team_id` | Per-org Salesforce config + encrypted refresh token |
| `user_memory` | `id` (idx `team_id, user_id`) | Per-user conversation turns with the bot (encrypted), capped ~20 exchanges |
| `app_settings` | `team_id` | Per-team Anthropic API key (encrypted) |

Tokens/secrets are encrypted with **AES-256-GCM** ([db/crypto.js](db/crypto.js)) using `TOKEN_ENC_KEY`.
Without the key, values are stored base64 with a one-time warning (dev only).

---

## 6. Running it as a developer

### Prerequisites
- **Node ≥ 20** — check `node -v`.
- An **Anthropic API key**.
- A Slack workspace where you can install apps (the [Slack Developer Program](https://api.slack.com/developer-program) gives you a sandbox).

### Install dependencies
```sh
npm install
```

### Configure `.env`
Copy [.env.example](.env.example) to `.env` and fill in at minimum:
```sh
ANTHROPIC_API_KEY=sk-ant-...
SLACK_BOT_TOKEN=xoxb-...        # Socket Mode (dev)
SLACK_APP_TOKEN=xapp-...        # app-level token, connections:write scope
```
Everything else is optional and degrades gracefully (Salesforce → mock, no user token → no search/canvas).

### Run — Socket Mode (simplest dev loop)
```sh
npm start                 # = node --disable-warning=ExperimentalWarning app.js
# or, with the Slack CLI:
slack run
```
This needs no public URL. Handoffs, briefs, the conversational agent, slash commands, and App Home
all work against your local `loop.db`.

### Run — OAuth/HTTP (test the multi-tenant path locally)
```sh
ngrok http 3000           # get a public https URL
# set SLACK_CLIENT_ID/SECRET/SIGNING_SECRET, SLACK_REDIRECT_URI, TOKEN_ENC_KEY in .env
npm run start:oauth
# open https://<ngrok>/slack/install to install via OAuth
```
See [DEPLOY.md](DEPLOY.md) for the production version of this.

### Verify
```sh
npm run check     # tsc type-check (checkJs) on the app.js graph
npm test          # node --test, 33 unit tests
npm run lint      # Biome
```

### Helper scripts (test pieces in isolation)
```sh
node scripts/peek.js                              # dump loop.db grouped by team
node scripts/seed-expertise.js <TEAM> <USER> billing 3   # preload expertise so routing fires
node scripts/slack-check.js [term]                # verify the user token + search scopes
node scripts/related-check.js ["transcript"]      # test "seen before" search
node scripts/sf-mcp-login.js                      # one-time Salesforce PKCE login → refresh token
node scripts/sf-test.js <CASE_NUMBER> [TEAM]      # test the live Salesforce path, no Slack
node scripts/canvas-check.js <CHANNEL_ID>         # drop a sample dossier canvas
```

---

## 7. Installing into a Slack workspace

### Option A — Slack CLI (fastest for dev)
```sh
slack login
slack install            # uses manifest.json, installs to a workspace you pick
slack run                # start in Socket Mode
```
Then **enable the Slack MCP feature** (no manifest flag yet): `slack app settings` → **Agents & AI
Apps** → toggle **Slack Model Context Protocol** on. This is required for the search/canvas features.

### Option B — From an app manifest (App Settings UI)
1. Go to [api.slack.com/apps/new](https://api.slack.com/apps/new) → **From an app manifest**.
2. Pick your workspace, paste [manifest.json](manifest.json), create.
3. **Install to Workspace** → Allow.
4. Copy the **Bot User OAuth Token** (`xoxb-`) into `.env` as `SLACK_BOT_TOKEN`; from **Basic
   Information** create an **app-level token** with `connections:write` → `.env` as `SLACK_APP_TOKEN`.
5. For search/canvas: open **OAuth & Permissions**, copy the **User OAuth Token** (`xoxp-`) into
   `.env` as `SLACK_USER_TOKEN` (Socket-Mode dev only — in OAuth mode this comes from the install).
6. Enable the Slack MCP feature as in Option A.

### Option C — Multi-tenant OAuth distribution (production)
Activate **Public Distribution**, set the OAuth/Events/Interactivity URLs to your public host, run
`npm run start:oauth`, and have each workspace install at `https://<host>/slack/install`. Full steps
in [DEPLOY.md](DEPLOY.md). Per-org Salesforce is connected from the App Home **Connect Salesforce**
button — see [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md).

### Using it

**The handoff brief (core flow)**
- **Invite the bot** to a customer channel: `/invite @loop`.
- In a thread, write a handoff: `@teammate can you take this one?` → the teammate gets a DM brief
  with the issue, what's been tried, the routing nudge, and a canvas link.
- Reference a case (`Case 00012345`) in the thread to pull live **Salesforce** context into the brief.
- If a stronger expert exists for the topic, the brief offers **Loop them in** → pulls them into the thread.

**Act on the brief**
- Click **✍️ Draft a reply** on the brief → Loop drafts a customer-ready response from the thread +
  Salesforce + prior history → **📨 Post to thread** to send it, or **🔁 Regenerate** / copy-edit.
- **Reply to the brief DM** with a follow-up ("what was the error code?") → answered with the full
  handoff context, and the agent can dig further with its Slack/Salesforce tools.

**Conversational agent + memory**
- **DM the bot** or **@mention** it anywhere for the assistant (Slack search, Salesforce lookups, etc.).
- It remembers **your own** past conversations across threads/restarts. Run **`/forget-me`** to erase
  your stored memory; it never recalls anyone else's.

**Visibility**
- Open the **Home** tab for the dashboard: active customer threads, "who knows what", recent cases,
  and the **Connect Salesforce** button.
- Run **`/customer-history`** for recent customer threads + handoffs.

---

## 8. File-by-file reference

### Entry points & config
| File | Purpose |
|---|---|
| [app.js](app.js) | Socket-Mode entry (dev). Builds the Bolt `App` with bot+app tokens, registers listeners. |
| [app-oauth.js](app-oauth.js) | HTTP/OAuth entry (production, multi-tenant). SQLite install store with a bot-token dev fallback; custom `/salesforce/callback` route; OAuth installer options. |
| [manifest.json](manifest.json) | Slack app config: scopes (bot + user), events, slash commands (`/customer-history`, `/forget-me`), MCP enabled, distribution. |
| [package.json](package.json) | Scripts (`start`, `start:oauth`, `check`, `test`, `lint`), deps, `engines.node >= 20`. |
| [Dockerfile](Dockerfile) / [.dockerignore](.dockerignore) | Container build for Cloud Run/ECS/K8s; `loop.db` on a `/data` volume. |
| [.env.example](.env.example) | All env vars (Anthropic, Slack, Salesforce, distribution, crypto) with inline docs. |
| [biome.json](biome.json) | Lint/format config. |

### Listeners — wiring
| File | Purpose |
|---|---|
| [listeners/index.js](listeners/index.js) | `registerListeners(app)` — calls each group's `register`. |
| [listeners/events/index.js](listeners/events/index.js) | Wires `app_home_opened`, `app_mention`, `assistant_thread_started`, and **two** `message` handlers (`handleMessage` + `handleHandoff`). |
| [listeners/actions/index.js](listeners/actions/index.js) | Wires `feedback`, `loop_in_expert`, `connect_salesforce` actions. |
| [listeners/commands/index.js](listeners/commands/index.js) | Wires `/customer-history`. |
| [listeners/views/index.js](listeners/views/index.js) | Wires the `sf_connect_modal` view submit. |

### Listeners — events
| File | Purpose |
|---|---|
| [listeners/events/handoff.js](listeners/events/handoff.js) | **Core.** Detects handoffs, runs the enrichment pipeline (§2), DMs the brief, learns expertise, syncs the canvas. |
| [listeners/events/message.js](listeners/events/message.js) | Conversational agent for DMs + engaged threads; streams Claude's reply with feedback buttons. |
| [listeners/events/app-mentioned.js](listeners/events/app-mentioned.js) | Same conversational agent, triggered by @mention in a channel. |
| [listeners/events/app-home-opened.js](listeners/events/app-home-opened.js) | Gathers the per-team dashboard (threads/expertise/cases/SF status) and publishes the Home view. |
| [listeners/events/assistant-thread-started.js](listeners/events/assistant-thread-started.js) | Sets suggested prompts when the assistant panel opens. |

### Listeners — actions / commands / views
| File | Purpose |
|---|---|
| [listeners/actions/loop-in-expert.js](listeners/actions/loop-in-expert.js) | "Loop them in" button → posts the expert into the thread, records the handoff + expertise. |
| [listeners/actions/connect-salesforce.js](listeners/actions/connect-salesforce.js) | "Connect/Edit Salesforce" → opens the (prefilled, edit-aware) config modal with where-to-get hints; submit validates + starts the PKCE flow and shows the Authorize link. |
| [listeners/actions/settings.js](listeners/actions/settings.js) | "Add/Edit API key" → Settings modal to enter/update the team's Anthropic API key (with console link); saves encrypted. |
| [listeners/actions/draft-reply.js](listeners/actions/draft-reply.js) | "Draft a reply" → generates a customer-ready draft from the brief context; "Post to thread"/"Regenerate". |
| [listeners/actions/feedback-buttons.js](listeners/actions/feedback-buttons.js) | 👍/👎 on agent replies → ephemeral acknowledgement. |
| [listeners/commands/customer-history.js](listeners/commands/customer-history.js) | `/customer-history` → ephemeral list of recent threads + handoffs. |
| [listeners/commands/forget-me.js](listeners/commands/forget-me.js) | `/forget-me` → erases the caller's own stored conversation memory. |
| [listeners/views/app-home-builder.js](listeners/views/app-home-builder.js) | Builds the App Home Block Kit (MCP status + Loop dashboard + Connect-SF accessory). |
| [listeners/views/feedback-builder.js](listeners/views/feedback-builder.js) | Builds the `feedback_buttons` block appended to agent responses. |

### Agent (Claude calls)
| File | Purpose |
|---|---|
| [agent/agent.js](agent/agent.js) | Conversational agent via the **Claude Agent SDK** (`query`). Registers the emoji tool + Salesforce + Slack MCP servers; resumes sessions. |
| [agent/index.js](agent/index.js) | Re-exports `runAgent`. |
| [agent/classify-handoff.js](agent/classify-handoff.js) | Claude YES/NO: is this message a handoff? 8s budget; throws → heuristic fallback. |
| [agent/synthesize-brief.js](agent/synthesize-brief.js) | Claude → structured `{issue, tried, pending, topic}` JSON from the transcript. |
| [agent/infer-topic.js](agent/infer-topic.js) | Cheap keyword topic guess; fallback when synthesis is unavailable. |
| [agent/related-history.js](agent/related-history.js) | **Slack MCP** search (connector, streamed) → "seen this before" summary, or null. |
| [agent/draft-reply.js](agent/draft-reply.js) | Claude → a concise, customer-ready reply grounded only in the brief context. |
| [agent/anthropic.js](agent/anthropic.js) | Per-team Anthropic client factory (`getAnthropic`/`getTeamApiKey`) — uses the org's own API key, env fallback. |

### Salesforce
| File | Purpose |
|---|---|
| [salesforce/get-case.js](salesforce/get-case.js) | `parseCaseRef` + `getSalesforceCase(teamId, ref)`. Live via the **Salesforce MCP** connector (case + recent activity), cached, mock fallback. |
| [salesforce/sf-token.js](salesforce/sf-token.js) | `getAccessToken(teamId)` — mints/refreshes the SF OAuth token (env override → team connection → env), per-team cache. |
| [salesforce/connect.js](salesforce/connect.js) | Per-org PKCE connect: `startConnect` builds the authorize URL; `completeConnect` exchanges the code and stores the encrypted refresh token. |
| [salesforce/mcp-server.js](salesforce/mcp-server.js) | In-process MCP server exposing `get_salesforce_case` to the conversational agent (wraps the same source). |

### Data & crypto
| File | Purpose |
|---|---|
| [db/index.js](db/index.js) | libSQL/Turso data layer (async); schema + all team-scoped CRUD; `deleteTeamData`; SF-connection + app-settings getters/setters; per-user memory (`recordUserTurn`/`recentUserTurns`/`deleteUserMemory`); exports the shared `db`. |
| [db/crypto.js](db/crypto.js) | AES-256-GCM `encrypt`/`decrypt` for tokens at rest (`TOKEN_ENC_KEY`). |
| [db/installation-store.js](db/installation-store.js) | Bolt `InstallationStore` over SQLite — encrypted store/fetch, and **purge team data** on delete. |

### Slack helpers & brief
| File | Purpose |
|---|---|
| [brief/build-brief.js](brief/build-brief.js) | Renders the handoff brief Block Kit (Issue/Tried/Open, Salesforce, "Seen before", routing button, canvas link). |
| [slack/canvas.js](slack/canvas.js) | `syncThreadCanvas` — create/update the per-thread customer dossier canvas with the install's user token. |

### Thread context
| File | Purpose |
|---|---|
| [thread-context/store.js](thread-context/store.js) | `SessionStore` — in-memory map of `channel:thread → Claude session id`, TTL 24h, max 1000. |
| [thread-context/brief-context.js](thread-context/brief-context.js) | `BriefContextStore` (DM channel → handoff context, TTL 12h) + `buildFollowupPrompt` — lets a reply to the brief be answered with full context. |
| [thread-context/user-memory.js](thread-context/user-memory.js) | `buildMemoryPrompt` — renders a user's own prior turns (with the privacy boundary) as the agent's first-turn preamble. |
| [thread-context/index.js](thread-context/index.js) | Exports the singletons `sessionStore` and `briefContextStore`. |

### Scripts (dev/test utilities — not in the app graph)
| File | Purpose |
|---|---|
| [scripts/peek.js](scripts/peek.js) | Read-only dump of `loop.db`, grouped by team. |
| [scripts/seed-expertise.js](scripts/seed-expertise.js) | Preload the expertise map so the routing suggestion fires on the first test handoff. |
| [scripts/slack-check.js](scripts/slack-check.js) | Verify the Slack user token + search scopes. |
| [scripts/related-check.js](scripts/related-check.js) | Exercise the "seen before" search in isolation. |
| [scripts/sf-mcp-login.js](scripts/sf-mcp-login.js) | One-time Salesforce PKCE login → prints a refresh token for `.env`. |
| [scripts/sf-test.js](scripts/sf-test.js) | Test the live Salesforce case path without Slack. |
| [scripts/canvas-check.js](scripts/canvas-check.js) | Create a sample dossier canvas in a channel. |

### Tests
| File | Purpose |
|---|---|
| [tests/listeners/events/app-home-opened.test.js](tests/listeners/events/app-home-opened.test.js) | App Home publishes a view (with `teamId` in context). |
| [tests/listeners/views/app-home-builder.test.js](tests/listeners/views/app-home-builder.test.js) | App Home block structure. |
| [tests/listeners/views/feedback-builder.test.js](tests/listeners/views/feedback-builder.test.js) | Feedback block structure. |
| [tests/brief/build-brief.test.js](tests/brief/build-brief.test.js) | Brief renders the draft button, structured summary, Salesforce + seen-before sections. |
| [tests/thread-context/store.test.js](tests/thread-context/store.test.js) | Session store get/set/TTL/eviction. |
| [tests/thread-context/brief-context.test.js](tests/thread-context/brief-context.test.js) | Brief-context store + follow-up prompt rendering. |
| [tests/thread-context/user-memory.test.js](tests/thread-context/user-memory.test.js) | Memory preamble rendering + privacy framing. |
| [tests/db/user-memory.test.js](tests/db/user-memory.test.js) | Per-user memory **isolation**, forget-me, team purge (throwaway DB). |

---

## 9. Environment variables (summary)

| Var | Needed for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Always | Classifier + brief synthesis + MCP calls |
| `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN` | Socket Mode (dev) | App token needs `connections:write` |
| `SLACK_CLIENT_ID/SECRET/SIGNING_SECRET` | OAuth/HTTP | From Basic Information |
| `SLACK_STATE_SECRET`, `SLACK_REDIRECT_URI`, `PUBLIC_URL` | OAuth/HTTP | Public host URLs |
| `TOKEN_ENC_KEY` | Production | Encrypts tokens at rest — **required** in prod |
| `LOOP_DB_PATH` | Optional | SQLite file path (default `./loop.db`); point at a volume in prod |
| `SLACK_USER_TOKEN` | Search/canvas (dev) | In OAuth mode this comes from the install instead |
| `SALESFORCE_MCP_URL` + `SALESFORCE_CLIENT_ID` + `SALESFORCE_REFRESH_TOKEN` (+ `SALESFORCE_LOGIN_URL`, `SALESFORCE_CLIENT_SECRET`) | Live Salesforce (single-tenant) | Per-org orgs use the Connect flow instead |
| `SALESFORCE_MCP_TOKEN` | Dev override | A pasted access token; skips refresh |
| `PORT` | OAuth/HTTP | Default 3000 |
```
