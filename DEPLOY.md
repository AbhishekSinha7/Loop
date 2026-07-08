# Deploying Loop (multi-tenant)

Loop runs as a long-lived **Node ≥ 22.5** process (for built-in `node:sqlite`) behind a public
HTTPS URL, with the SQLite file `loop.db` on a persistent disk. **No separate database server.**

- **Dev / single workspace:** `slack run` (Socket Mode) — no public URL needed.
- **Production / any-org install:** `npm run start:oauth` (HTTP) behind a public URL.

## 1. Environment (production)

See [.env.example](.env.example). Minimum:

```
ANTHROPIC_API_KEY=...                                  # required
SLACK_CLIENT_ID / SLACK_CLIENT_SECRET / SLACK_SIGNING_SECRET
SLACK_STATE_SECRET=<random string>
SLACK_REDIRECT_URI=https://<public-host>/slack/oauth_redirect
PUBLIC_URL=https://<public-host>                        # used for the Salesforce callback
TOKEN_ENC_KEY=<32+ random chars>                       # encrypts tokens at rest — REQUIRED in prod
LOOP_DB_PATH=/data/loop.db                             # on the persistent volume
PORT=3000
```

## 2. Slack app config

- Activate **Public Distribution**.
- **OAuth Redirect URL:** `https://<public-host>/slack/oauth_redirect`
- **Event Subscriptions** request URL: `https://<public-host>/slack/events`
- **Interactivity** request URL: `https://<public-host>/slack/events`

## 3. Persistent storage

`loop.db` holds every installation (encrypted tokens) **and** all per-team data. Put it on a
mounted volume (point `LOOP_DB_PATH` at it) and back it up — include `loop.db-wal` / `loop.db-shm`.
Losing it means every workspace must reinstall.

## 4. Run + install

```
npm ci
npm run start:oauth
```

Then install at `https://<public-host>/slack/install`. Each org connects Salesforce from the
App Home **Connect Salesforce** button — and must register `https://<public-host>/salesforce/callback`
as the callback URL on their External Client App.

## Host notes

Render / Railway / Fly / a plain VM run the Node app directly — set the start command to
`npm run start:oauth`, attach a persistent disk where `LOOP_DB_PATH` points, and set the env.
Make sure the host's Node is **≥ 22.5** (the `engines` field in `package.json` pins it).

- **Render:** a ready blueprint is included — [render.yaml](render.yaml) (web service + 1 GB disk at
  `/data`, health check on `/health`, generated `TOKEN_ENC_KEY`/`SLACK_STATE_SECRET`). Create it via
  *New → Blueprint*, then paste the three Slack secrets and `PUBLIC_URL` in the dashboard.
- With `NODE_ENV=production` the app **exits at boot** if any required config is missing
  (`SLACK_CLIENT_ID/SECRET/SIGNING_SECRET`, `SLACK_STATE_SECRET`, `TOKEN_ENC_KEY`, `PUBLIC_URL`) and
  logs exactly which — a misconfigured deploy fails loudly instead of failing per-user.
- On boot it prints the four URLs to register (install, Slack request URL, OAuth redirect,
  Salesforce callback), all derived from `PUBLIC_URL`.
- `GET /health` returns `200 {"ok":true}` for platform health checks.

## Optional: Docker (only if your host wants a container — Cloud Run / ECS / Kubernetes)

A [Dockerfile](Dockerfile) (with [.dockerignore](.dockerignore)) is included.

```
docker build -t loop .
docker run -p 3000:3000 --env-file .env -v loop-data:/data loop
```

The `-v loop-data:/data` volume holds `loop.db` (default `LOOP_DB_PATH=/data/loop.db`); keep it
mounted and backed up across deploys, or every workspace must reinstall.
