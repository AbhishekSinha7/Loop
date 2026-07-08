# Salesforce Hosted MCP — setup

Connect Loop to a live Salesforce org via Salesforce's official **Hosted MCP Servers**.
Loop's code is already wired; these are the org-side steps + the one-time login.

Auth model: Salesforce hosted MCP uses **per-user OAuth 2.0 + PKCE**. Our connector sends a
bearer token, so you log in once to get a **refresh token**; Loop auto-refreshes the access token
at runtime (no expiry babysitting).

---

## 1. Have an org (free is fine)
Use your org, or create a free **Developer Edition**: https://developer.salesforce.com/signup
Make sure **My Domain** is deployed (default for new orgs): Setup → My Domain.

## 2. Enable a Hosted MCP Server
Setup → Quick Find → search **MCP** → open the Hosted MCP Servers page → enable the
**Salesforce Platform MCP Server** (the general CRM/Case one). **Copy its server URL** — that's your
`SALESFORCE_MCP_URL`.

## 3. Create an External Client App (the OAuth client)
Setup → Quick Find → **External Client App Manager** → **New External Client App**.
- Basic info: any name (e.g. "Loop").
- Expand **API (Enable OAuth Settings)** → check **Enable OAuth**.
- **Callback URL:** `http://localhost:1717/oauth/callback`  ← must be exactly this (the login helper listens here).
- **OAuth scopes:** add **Access MCP servers (`mcp_api`)** and **Perform requests at any time (`refresh_token`)**.
- Security: select **Issue JSON Web Token (JWT)-based access tokens for named users** and **Require Proof Key for Code Exchange (PKCE)**. **Deselect** Client Credentials Flow and the Web Server Flow secret (public PKCE client).
- Create, then open **Settings → Consumer Key and Secret** → copy the **Consumer Key** = your `SALESFORCE_CLIENT_ID`. (If it forces a secret, copy that into `SALESFORCE_CLIENT_SECRET`.)

## 4. Fill `.env`
```
SALESFORCE_MCP_URL=<the server URL from step 2>
SALESFORCE_LOGIN_URL=https://yourdomain.my.salesforce.com   # or https://login.salesforce.com
SALESFORCE_CLIENT_ID=<consumer key from step 3>
# SALESFORCE_CLIENT_SECRET=<only if your app kept a secret>
```

## 5. Log in once to get a refresh token
```
node scripts/sf-mcp-login.js
```
It prints an authorize URL — open it, approve, and it prints `SALESFORCE_REFRESH_TOKEN=...`.
Paste that into `.env`.

## 6. Test
Restart `slack run`. Post a thread referencing a **real case number from your org**, hand it off →
the brief's 🧾 Salesforce line now shows live values. The assistant can also answer
"what's the status of case <real#>?" via the same server.

---

### If it doesn't work
- **401 / auth error in the brief** (SF section silently missing): the access token was rejected.
  Re-run `node scripts/sf-mcp-login.js`; confirm the `mcp_api` scope is on the External Client App.
- **No refresh token printed:** the `refresh_token` scope isn't enabled on the app.
- **Connection error:** confirm `SALESFORCE_MCP_URL` is the server's Streamable-HTTP endpoint (copied
  from Setup), reachable over public HTTPS.
- Quick alternative to refresh setup: paste a short-lived access token as `SALESFORCE_MCP_TOKEN` in
  `.env` (takes precedence) to confirm the pipe works, then set up refresh for durability.

Send me the `SALESFORCE_MCP_URL` (not secret) and any error text and I'll help debug.
