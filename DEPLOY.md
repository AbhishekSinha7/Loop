# Deploying Loop (multi-tenant)

Loop runs as a long-lived **Node ≥ 20** process behind a public HTTPS URL. Its data store is
**libSQL/SQLite**: a local file in dev, and **[Turso](https://turso.tech)** (hosted libSQL, free tier)
in production — so it persists on any host, including free ones, with **no database server to run**.

- **Dev / single workspace:** `slack run` (Socket Mode) — no public URL needed; data in a local file.
- **Production / any-org install:** `npm run start:oauth` (HTTP) behind a public URL, data in Turso.

## 1. Create the database (Turso, free)

```
# one-time
curl -sSfL https://get.tur.so/install.sh | bash    # or: brew install tursodatabase/tap/turso
turso auth signup
turso db create loop
turso db show loop --url                 # → TURSO_DATABASE_URL (libsql://loop-<you>.turso.io)
turso db tokens create loop              # → TURSO_AUTH_TOKEN
```

## 2. Environment (production)

See [.env.example](.env.example). Minimum:

```
SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_SIGNING_SECRET   # api.slack.com/apps → Basic Information
SLACK_STATE_SECRET=<random string>
PUBLIC_URL=https://<public-host>                               # install links + Salesforce callback
TOKEN_ENC_KEY=<32+ random chars>                              # encrypts tenant secrets at rest — REQUIRED
TURSO_DATABASE_URL=libsql://<your-db>.turso.io
TURSO_AUTH_TOKEN=<from step 1>
PORT=3000
```

`ANTHROPIC_API_KEY` is **not** needed here — each workspace enters its own key in the App Home
**Settings** modal. (An env key, if set, is only a fallback.) Same for Salesforce and Slack tokens:
those come from each org's install + Connect flow, never from this env.

## 3. Slack app config

- Activate **Public Distribution**; **Socket Mode OFF**.
- **OAuth Redirect URL:** `https://<public-host>/slack/oauth_redirect`
- **Event Subscriptions** request URL: `https://<public-host>/slack/events`
- **Interactivity** request URL: `https://<public-host>/slack/events`
- **Agents & AI Apps → Model Context Protocol:** ON.

## 4. Run + install

```
npm ci
npm run start:oauth
```

Then install at `https://<public-host>/slack/install`. Each org, from the App Home:
- **Add API key** → their Anthropic key.
- **Connect Salesforce** → registers `https://<public-host>/salesforce/callback` on their External
  Client App, then authorizes.

## Host notes

Render / Railway / Fly / a plain VM run the Node app directly — start command `npm run start:oauth`,
set the env above. Because data lives in Turso, **no persistent disk is required** and free tiers work.

- **Render (free):** a ready blueprint is included — [render.yaml](render.yaml) (free web service, health
  check on `/health`, generated `TOKEN_ENC_KEY`/`SLACK_STATE_SECRET`). *New → Blueprint*, then paste the
  Turso vars, the three Slack secrets, and `PUBLIC_URL`. Free instances cold-start after idle (~30–60s);
  bump `plan: starter` for always-on.
- With `NODE_ENV=production` the app **exits at boot** if any required config is missing
  (`SLACK_CLIENT_ID/SECRET/SIGNING_SECRET`, `SLACK_STATE_SECRET`, `TOKEN_ENC_KEY`, `PUBLIC_URL`) and logs
  exactly which. It also **warns** if you're in production without `TURSO_DATABASE_URL` (ephemeral data).
- On boot it prints the four URLs to register (install, Slack request URL, OAuth redirect, Salesforce
  callback), all derived from `PUBLIC_URL`.
- `GET /health` returns `200 {"ok":true}`.

## Optional: Docker (Cloud Run / ECS / Kubernetes)

A [Dockerfile](Dockerfile) (with [.dockerignore](.dockerignore)) is included. With Turso there's no
volume to mount:

```
docker build -t loop .
docker run -p 3000:3000 --env-file .env loop
```
