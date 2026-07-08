# Testing Loop — manual runbook

Step-by-step actions to exercise everything built so far (handoff brief, Salesforce
context, expertise routing, `/customer-history`). Most steps are hands-on in Slack;
two helper scripts support the data-driven parts.

---

## 0. One-time setup

1. **PowerShell exec policy** (only if `slack` commands fail to run scripts):
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
   ```
2. **API key** — confirm `.env` has a real `ANTHROPIC_API_KEY` (the brief/classifier need it).
3. **Install deps** (already done, safe to repeat): `npm install`
4. **Re-sync the Slack app.** `manifest.json` changed — it added the `commands` scope and the
   `/customer-history` slash command. When you start the app (step 1 below), the Slack CLI will
   detect the manifest change; **accept the prompt to update/reinstall the app and re-grant scopes.**
   If `/customer-history` isn't recognized later, reinstall the app (CLI prompt or app settings).
5. **Invite the bot** to your test channel if it isn't already there: `/invite @loop`
   (You already have handoff data in one channel, so it's likely invited there.)
6. **A second user helps.** You need at least one other member to `@mention` as the handoff target.
   You *can* `@mention yourself` — Loop will DM you the brief (the author isn't excluded). The
   routing test (§4) is clearest with two real users.

---

## 1. Start the app

```
slack run
```
Leave it running and watch its console for logs/errors. **Don't run `slack run` on two machines at once** (duplicate events).

## 2. Inspect the store (use anytime)

```
node scripts/peek.js
```
Read-only dump of `loop-data.json`: threads, handoffs, the expertise map, and cached Salesforce cases.
Run it after each test to confirm what got persisted.

> The running app loads `loop-data.json` only at startup. Anything you seed (§4) must be done **before** `slack run`.

---

## 3. Phase 1 — handoff detection + brief

**Positive path**
1. In the test channel, start a thread — post a "customer" message:
   > Customer can't log in — getting a 403 on SSO.
2. Reply in that thread once or twice to build context:
   > Checked their SAML config, looks fine.
   > Tried resetting their session — still failing.
3. Post a real handoff (in the thread or channel):
   > @teammate can you take this over? Need someone from auth.

**Expect:** the mentioned user gets a DM headed **"📋 You've been looped in"** with
**Issue / Tried so far / Open question** (synthesized by Claude). The app console shows no errors.

**Negative path (not a handoff)**
4. Post:
   > thanks @teammate for the help!

**Expect:** *no* DM — the classifier recognizes this isn't a handoff.

**Degrade test (optional — proves the timeout/fallback)**
5. Put a bad value in `ANTHROPIC_API_KEY`, restart `slack run`, repeat step 3.
   **Expect:** within ~8–20s you still get a DM, but the brief is the raw recent-messages
   fallback (no Issue/Tried/Open) — it degrades instead of freezing. Restore the key + restart.

---

## 4. Phase 2 — Salesforce case context

**Live vs mock.** Set `SALESFORCE_MCP_URL` (+ `SALESFORCE_MCP_TOKEN`) in `.env` to query your
hosted Salesforce MCP server for real; leave them unset for deterministic mock data. See
`.env.example`. With live config, use a **real case number from your org** (the mock fixtures
`00012345`/`00067890` won't exist there), and **restart `slack run`** after editing `.env`.

1. Start a thread that names a case number:
   > Customer on Case #00012345 is blocked on SSO.   (live: use a real case # from your org)
2. Hand it off:
   > @teammate can you jump on this?

**Expect:** the brief now includes a **🧾 Salesforce** line, e.g.
`Case 00012345 · Acme Corp (Enterprise) · Status: Escalated · 4 prior cases`.
(Unconfigured = mock fixtures + deterministic data. Configured = live values from your Salesforce
MCP server, fetched via the Anthropic MCP connector and cached for 5 min.)

**Salesforce over MCP (the required-tech surface)**
3. DM the bot (or @mention it): *"what's the status of Salesforce case <real#>?"*
   The assistant calls your Salesforce MCP tools (or the in-process `get_salesforce_case` mock when
   unconfigured) and answers.
   > Note: the conversational assistant uses the Agent SDK runtime, which was unreliable on this
   > box. If that DM hangs, it's the known `query()` issue — separate from the handoff brief path,
   > which uses the direct SDK and is unaffected.
4. Verify: `node scripts/peek.js` → the case appears under "Salesforce cases".

---

## 5. Phase 3 — expertise routing ("want me to loop in @expert?")

A suggestion only fires when someone already has **more** handoffs in a topic than the person
you're looping in. Two ways to set that up:

**Fast path — seed an expert**
1. Stop `slack run`.
2. Seed a real member as the billing expert (use their member ID — profile → ⋯ → Copy member ID):
   ```
   node scripts/seed-expertise.js U0B8W1321M0 billing 3
   ```
3. Start `slack run` again (so it loads the seed).
4. Post a billing thread and hand it to a **different** user:
   > Customer wants a refund on their invoice.
   > @other-teammate can you take this?

**Expect:** the other user's brief includes
**"💡 <@expert> has handled more *billing* handoffs — want me to loop them in?"** with a
**Loop them in** button.
5. Click **Loop them in** → the bot posts in the original thread tagging the expert, and you get a
   **"✅ Looped in"** confirmation.

**Manual path (no seed):** hand the *same topic* to the *same* user 2–3 times first (that builds
their expertise), then hand a same-topic thread to a different user → the suggestion appears.

Check the map anytime: `node scripts/peek.js` → "Expertise map".

---

## 6. Phase 4 — `/customer-history`

1. In any channel, run:
   ```
   /customer-history
   ```

**Expect:** an ephemeral **"🗂️ Customer history"** list of recent threads — each with the channel,
🔁 handoff count, "updated …", and who was looped in. (You already have threads recorded, so this
shows data right away. If you see "No customer threads recorded yet," do a handoff first.)

---

## 7. Phase 5 — App Home dashboard

1. Restart `slack run` (to load the new code), then in Slack click **Loop** in the sidebar → **Home** tab.

**Expect:** below the welcome + MCP status, a **📋 Loop — Customer Whisperer** dashboard with three sections:
- **🔁 Active customer threads** — recent threads with handoff counts + who's looped in (🔥 on any handed off 3×+).
- **🧠 Who knows what** — the expertise map (topic → top experts with counts).
- **🧾 Recent Salesforce cases** — recently looked-up cases (live ones have no _(mock)_ tag).

The tab refreshes each time you open it, so switch away and back after new handoffs to see updates.

## 8. Slack MCP features (needs `SLACK_USER_TOKEN`)

These require the user token (`node scripts/slack-check.js` green). Test each in isolation first:
- **Seen-this-before search:** `node scripts/related-check.js` — searches your workspace for related prior threads (have a couple of related messages somewhere first).
- **Customer canvas:** `node scripts/canvas-check.js <CHANNEL_ID>` — creates a sample dossier canvas in a channel you're a member of; prints the canvas id + link.

Then in a real handoff (restart `slack run` first), the DM brief gains:
- **🔎 Seen before** — related prior threads, when the workspace search finds any.
- **📄 Open the live customer dossier** — a link to a Slack canvas (also tabbed in the channel) holding the brief + Salesforce + history + handoff log; it updates on each new handoff.

If the canvas link doesn't resolve, the canvas is still in the channel's **canvas tab** (the link is best-effort; `canvas-check.js` confirms creation regardless).

## Reset / cleanup

- Fresh start: stop `slack run`, delete `loop-data.json` (back it up first if you want), restart.
- Inspect anytime: `node scripts/peek.js`.

## Quick reference — features → files

| Feature | Where |
|---|---|
| Handoff detect + brief | `listeners/events/handoff.js`, `agent/classify-handoff.js`, `agent/synthesize-brief.js`, `brief/build-brief.js` |
| Salesforce context + MCP | `salesforce/get-case.js`, `salesforce/mcp-server.js` (wired into `agent/agent.js`) |
| Expertise routing | `db/index.js`, `agent/infer-topic.js`, `listeners/actions/loop-in-expert.js` |
| `/customer-history` | `listeners/commands/customer-history.js` |
