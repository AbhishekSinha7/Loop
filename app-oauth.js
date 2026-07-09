import 'dotenv/config';

import { readFileSync } from 'node:fs';

import { App, LogLevel } from '@slack/bolt';

import { registerListeners } from './listeners/index.js';
import { installationStore as sqliteStore } from './db/installation-store.js';
import { completeConnect } from './salesforce/connect.js';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf-8'));
const botScopes = manifest.oauth_config.scopes.bot;
const userScopes = manifest.oauth_config.scopes.user;

// ---------------------------------------------------------------------------
// Installation store with bot-token fallback
// ---------------------------------------------------------------------------
// When installed via Slack CLI, SLACK_BOT_TOKEN is available but Bolt clears
// it when OAuth options are present. This wrapper lets the bot token serve as
// a fallback so App Home (with the OAuth install URL) and basic bot operations
// work before anyone has completed the OAuth flow.

const fallbackBotToken = process.env.SLACK_BOT_TOKEN;

// ---------------------------------------------------------------------------
// Production config validation — fail fast on a misconfigured deployment
// ---------------------------------------------------------------------------
// A hosted (multi-tenant) instance cannot work without these. In production we
// exit immediately with a precise message instead of failing at first install
// or showing users the "Salesforce isn't set up" notice.

const IS_PROD = process.env.NODE_ENV === 'production';

/** @type {Array<[string, string]>} */
const REQUIRED_PROD_CONFIG = [
  ['SLACK_CLIENT_ID', 'OAuth install flow (Basic Information → Client ID)'],
  ['SLACK_CLIENT_SECRET', 'OAuth install flow (Basic Information → Client Secret)'],
  ['SLACK_SIGNING_SECRET', 'request signature verification (Basic Information → Signing Secret)'],
  ['SLACK_STATE_SECRET', 'OAuth state signing (any long random string)'],
  ['TOKEN_ENC_KEY', 'encrypting tenant tokens at rest (any long random string)'],
  ['PUBLIC_URL', "the app's public HTTPS origin, e.g. https://loop.example.com — used for the Salesforce callback and install links"],
];

{
  const missing = REQUIRED_PROD_CONFIG.filter(([k]) => !process.env[k]);
  if (missing.length > 0) {
    const lines = missing.map(([k, why]) => `  - ${k}: ${why}`);
    if (IS_PROD) {
      console.error(`[loop] FATAL: missing required production config:\n${lines.join('\n')}`);
      process.exit(1);
    }
    console.warn(`[loop] Dev mode — missing config (required in production):\n${lines.join('\n')}`);
  }
}

/** Public origin of this deployment (no trailing slash). */
const publicUrl = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');

/** @type {import('@slack/bolt').InstallationStore} */
const installationStore = {
  storeInstallation: (installation) => sqliteStore.storeInstallation(installation),
  fetchInstallation: async (query) => {
    try {
      return await sqliteStore.fetchInstallation(query);
    } catch (e) {
      // Dev convenience: fall back to the bot token before anyone has OAuthed.
      if (fallbackBotToken) {
        return /** @type {any} */ ({ bot: { token: fallbackBotToken } });
      }
      throw e;
    }
  },
  deleteInstallation: (query) => sqliteStore.deleteInstallation(query),
};

const app = new App({
  logLevel: LogLevel.DEBUG,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  ignoreSelf: false,
  clientId: process.env.SLACK_CLIENT_ID,
  clientSecret: process.env.SLACK_CLIENT_SECRET,
  stateSecret: process.env.SLACK_STATE_SECRET || 'bolt-js-starter-agent',
  scopes: botScopes,
  installationStore,
  customRoutes: [
    {
      // Health probe for hosting platforms (Render/Railway/Fly/K8s).
      path: '/health',
      method: ['GET'],
      handler: (_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      },
    },
    {
      path: '/salesforce/callback',
      method: ['GET'],
      handler: async (req, res) => {
        try {
          const u = new URL(req.url || '', 'http://localhost');
          const code = u.searchParams.get('code');
          const state = u.searchParams.get('state');
          if (!code || !state) throw new Error('missing code/state');
          await completeConnect(code, state);
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<h3>✅ Salesforce connected. You can close this tab.</h3>');
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(`<h3>Salesforce connection failed.</h3><pre>${e}</pre>`);
        }
      },
    },
  ],
  installerOptions: {
    stateVerification: true,
    // Verify the signed JWT state only, not a browser cookie. The cookie often
    // doesn't survive the redirect through Slack on hosted/proxied deploys
    // (Render, etc.), causing `slack_oauth_invalid_state`. The JWT is signed with
    // SLACK_STATE_SECRET and expires in 10 min, so CSRF protection is retained.
    legacyStateVerification: true,
    userScopes,
  },
});

registerListeners(app);

(async () => {
  const port = Number.parseInt(process.env.PORT || '3000', 10);
  await app.start(port);
  app.logger.info(`Loop is running on port ${port}${IS_PROD ? ' (production)' : ''}`);
  const origin = publicUrl || (process.env.SLACK_REDIRECT_URI ? new URL(process.env.SLACK_REDIRECT_URI).origin : null);
  if (origin) {
    app.logger.info(`Install URL:          ${origin}/slack/install`);
    app.logger.info(`Slack request URL:    ${origin}/slack/events`);
    app.logger.info(`OAuth redirect URL:   ${origin}/slack/oauth_redirect`);
    app.logger.info(`Salesforce callback:  ${origin}/salesforce/callback`);
  }
})();
