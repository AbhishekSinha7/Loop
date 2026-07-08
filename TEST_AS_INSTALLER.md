# Test Loop as a real installer (no tenant credentials in `.env`)

Goal: install Loop via OAuth like any workspace would, then add the **Anthropic API key** and
**Salesforce** connection from inside Slack — nothing per-tenant read from `.env`.

## What goes where

| Belongs in `.env` (the app's own identity) | Comes from OAuth / the Slack UI (per tenant) |
|---|---|
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET` | Bot token + user token → from the OAuth install (stored encrypted in `loop.db`) |
| `SLACK_STATE_SECRET`, `TOKEN_ENC_KEY` | Anthropic API key → App Home → **Add API key** |
| `PUBLIC_URL`, `SLACK_REDIRECT_URI`, `PORT` | Salesforce login/MCP/client_id/secret → App Home → **Connect Salesforce** |

**Do NOT set** `ANTHROPIC_API_KEY`, `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`, `SLACK_USER_TOKEN`, or any
`SALESFORCE_*` — leaving them unset is the whole point of this test (proves the install + modals supply them).

---

## 1. `.env` — app identity only

```
SLACK_CLIENT_ID=...                 # api.slack.com/apps → your app → Basic Information
SLACK_CLIENT_SECRET=...             # same page
SLACK_SIGNING_SECRET=...            # same page
SLACK_STATE_SECRET=any-long-random-string
TOKEN_ENC_KEY=any-32+char-random-string     # encrypts every tenant secret at rest
PUBLIC_URL=https://<subdomain>.ngrok-free.app
SLACK_REDIRECT_URI=https://<subdomain>.ngrok-free.app/slack/oauth_redirect
PORT=3000
```

(Comment out / delete the tenant lines listed above if they're currently set.)

## 2. Start the tunnel + app

```sh
ngrok http 3000           # copy the https URL into PUBLIC_URL + SLACK_REDIRECT_URI above
npm run start:oauth
```

## 3. Slack app config (api.slack.com/apps → your app)

- **Settings → Socket Mode:** **OFF** (HTTP mode delivers events to your URL).
- **OAuth & Permissions → Redirect URLs:** `https://<subdomain>.ngrok-free.app/slack/oauth_redirect`
- **Event Subscriptions → Request URL:** `https://<subdomain>.ngrok-free.app/slack/events`
- **Interactivity → Request URL:** `https://<subdomain>.ngrok-free.app/slack/events`
- **Agents & AI Apps → Model Context Protocol:** **ON** (enables search + canvases via the user token).
- (Manage Distribution → Activate Public Distribution if you'll install into a workspace other than your own.)

> Re-uploading [manifest.json](manifest.json) does most of this — but set its `socket_mode_enabled` to
> `false` and replace every `ngrok-free.app` host with your subdomain first.

## 4. Install (this is the "installer" moment)

Open **`https://<subdomain>.ngrok-free.app/slack/install`** → **Allow**.

That OAuth grant stores the **bot + user tokens encrypted in `loop.db`** — no env tokens involved.
The install URL is also printed in the terminal on startup.

## 5. Configure as the installer, inside Slack

Open the Loop app's **Home** tab — it shows what's missing:

1. **Add API key** → paste your Anthropic key (`console.anthropic.com → Settings → API keys`) → **Save**.
   Stored encrypted, used only for your workspace. (Required — Loop's Claude calls use *your* key now.)
2. **Connect Salesforce** → the modal shows the exact callback URL to register
   (`https://<subdomain>.ngrok-free.app/salesforce/callback`) — paste that into your **External Client
   App → OAuth → Callback URL** first. Then fill My Domain / MCP URL / client_id (+ secret) → **Continue**
   → **Authorize in Salesforce** → approve → tab says connected.

Re-open either button any time to **edit** the values.

## 6. Verify the tenant path end-to-end

- In a channel with the bot invited, post a thread and hand it off (`@teammate can you take this?`).
- The brief should appear using **your team's** Anthropic key and **your** Salesforce data.
- DM the bot — the assistant runs on your key too.
- App Home shows **Claude: configured** and **Salesforce: connected**.

## Gotchas

- **Free ngrok rotates its domain on restart.** When it changes, update `PUBLIC_URL`,
  `SLACK_REDIRECT_URI`, the three Slack URLs, and the Salesforce callback. A reserved/paid ngrok domain
  (or a real deploy per [DEPLOY.md](DEPLOY.md)) avoids this.
- **"Connect Salesforce" shows the not-configured notice** → `PUBLIC_URL` isn't an `https://…` URL yet.
- **Claude calls fail before you add a key** → expected; add it in step 5.1. The handoff brief degrades
  gracefully (heuristics / raw template); the DM assistant needs the key.
- Each installed workspace is fully isolated — its own tokens, Anthropic key, Salesforce, and data.
