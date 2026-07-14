# Loop — Privacy Policy

_Last updated: 2026-07-10_

Loop ("the app", "we") is an ambient Slack assistant that helps customer-facing teams by
summarizing handoffs, surfacing Salesforce case context, searching prior workspace discussions,
drafting replies, and remembering a user's prior conversations with the assistant. This policy
explains what data Loop processes, why, and how it is protected.

> **Contact:** er.abhisheksinha7@gmail.com

## What we store

Loop stores data **per Slack workspace** (keyed by Slack `team_id`) in a hosted libSQL/Turso
database. Secrets are **encrypted at rest** (AES-256-GCM). We store:

| Data | Purpose | Encrypted |
|---|---|---|
| Slack installation tokens (bot + user OAuth tokens) | Post briefs, read threads, run search/canvas on the workspace's behalf | ✅ |
| Thread metadata — channel/thread IDs, handoff events (from/to user IDs, timestamps) | Track customer threads + who was looped in | — |
| Expertise counts (topic + user ID) | Suggest the strongest expert for a routing topic | — |
| Cached Salesforce case fields (status, account, tier, recent activity) | Show case context in the brief (5-minute cache) | — |
| Per-user conversation memory (recent chat turns with the assistant, ~20 max) | Let the assistant recall your own prior conversations | ✅ |
| Per-workspace Anthropic API key | Run the workspace's AI features on its own key | ✅ |
| Per-workspace Salesforce connection (MCP URL, login URL, client ID, refresh token, client secret) | Fetch live case data for that org | ✅ (tokens/secret) |

We do **not** store full channel message archives, and we do **not** sell data.

## What we send to third parties

To function, Loop sends the **minimum necessary** content to:

- **Anthropic (Claude)** — thread transcripts and the assistant's messages are sent to the Anthropic
  API to classify handoffs, synthesize briefs, draft replies, and power the assistant. Each workspace
  uses its own Anthropic API key.
- **Salesforce** — when a workspace connects Salesforce, Loop queries that org's own Salesforce data
  (via its hosted MCP server) using the workspace's own credentials.
- **Slack** — Loop uses the workspace's own Slack tokens to read threads, post messages, search, and
  manage canvases within that same workspace.

No data is shared with any party beyond these processors, and each only receives data for the
workspace it belongs to.

## Data isolation

Every record is scoped by Slack `team_id`; one workspace's data is never accessible to another. AI
calls, Slack search, and Salesforce lookups all run with that workspace's own credentials and keys.

## Retention & deletion

- **Uninstall:** removing Loop from a workspace deletes that workspace's installation tokens **and all
  of its data** (threads, handoffs, expertise, cases, memory, settings, Salesforce connection).
- **`/forget-me`:** any user can erase their own stored conversation memory at any time.
- **Case cache:** Salesforce case data is cached for ~5 minutes, then refreshed.

## Security

- Secrets (Slack tokens, Anthropic key, Salesforce refresh token/secret, user memory) are encrypted at
  rest with AES-256-GCM.
- All traffic is over HTTPS.
- Per-tenant isolation by `team_id`.

## Changes

We may update this policy; material changes will be reflected by the "Last updated" date above.

## Contact

Questions or data-deletion requests: **er.abhisheksinha7@gmail.com**.
