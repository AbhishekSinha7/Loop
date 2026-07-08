# Loop — Demo Script & Data

A single coherent storyline that exercises **every** Loop feature: handoff detection, the synthesized
brief, live Salesforce case context, "seen before" workspace search, expertise routing, the canvas
dossier, auto-draft reply, brief follow-ups, per-user memory (+ isolation), App Home, and the slash
commands.

> **Salesforce: live or mock.** With `SALESFORCE_MCP_URL` unset, Loop returns rich **mock** case data
> for the numbers below (`00012345` Acme, `00067890` Globex) — good for a quick run. For a **live** org
> demo (no mock), follow **[DEMO_SALESFORCE.md](DEMO_SALESFORCE.md)** to create the real Case / Case
> Comments / Account / Tasks, then use **your org's real case numbers** in the Slack thread below.

---

## Cast & channels

| Slack user | Role in the story |
|---|---|
| **Priya** | Front-line support, owns the Acme account, starts the thread |
| **Marcus** | Teammate who gets handed the case (receives the brief) |
| **Dana** | The SSO/login expert — Loop will suggest looping her in |

| Channel | Use |
|---|---|
| `#cust-acme` | The live customer thread (invite the bot here) |
| `#support-archive` | Holds the prior resolved thread that "seen before" will find |

---

## One-time setup (≈3 min)

**1. Invite the bot** to both channels:
```
/invite @loop
```

**2. Seed Dana's SSO expertise** so the routing nudge fires. Substitute your real `TEAM_ID` and
Dana's `USER_ID` (Slack profile → ⋯ → *Copy member ID*). Seed a few topic variants so it matches
whatever label the model assigns:
```sh
node scripts/seed-expertise.js <TEAM_ID> <DANA_USER_ID> "login / SSO" 5
node scripts/seed-expertise.js <TEAM_ID> <DANA_USER_ID> "SSO login" 5
node scripts/seed-expertise.js <TEAM_ID> <DANA_USER_ID> "SSO" 5
```
> **Bulletproof version:** run the handoff once, then `node scripts/peek.js` to see the exact topic
> Loop recorded, then re-seed Dana under that exact string with count 5 and re-run.

**3. Post the prior "seen before" thread** in `#support-archive` (as **Dana**), so workspace search
has something rich to find. Post it a minute early so Slack indexes it:

> 🟢 **[Resolved] Northwind — SSO "SAML assertion invalid" after cert rotation**
> Root cause: when Northwind rotated their SAML signing certificate, the **IdP-side signing
> certificate fingerprint wasn't updated**, so our SP rejected every assertion. Fix: had them
> **re-publish the IdP metadata** and we **cleared the cached cert in the SSO config** — resolved in
> ~20 minutes. Tagging for the runbook. — Dana

---

## The main demo — Acme SSO escalation

Post these three messages in `#cust-acme` as **Priya** (same thread — send #1, then reply #2 and #3
in-thread). The third one is the handoff trigger.

**1.**
> 🔴 Acme Corp can't log in via SSO since ~8am — users get `SAML assertion invalid` immediately after
> the IdP redirect. It started right after we rotated their SAML signing certificate last night.
> Salesforce **Case 00012345**.

**2.**
> What I've checked so far: re-uploaded the new signing cert on our side, confirmed their ACS URL and
> Entity ID are unchanged, and validated that the IdP metadata XML parses. The error still fires for
> every user.

**3.** *(this fires the handoff)*
> It's their Enterprise SSO, so all ~200 Acme users are locked out — already escalated. I've got
> another P1 starting now. **@Marcus can you take this one and run with it?**

---

## What to point out (the payoff)

Within a couple of seconds, **Marcus gets a DM brief**. Walk through it:

1. **Synthesized brief** — *Issue / Tried so far / Open question*, written by Claude from the thread
   (not a raw dump).
2. **🧾 Salesforce** — `Case 00012345 · Acme Corp (Enterprise) · Status: Escalated · 4 prior cases`,
   plus a **_Latest:_** line pulled from the case's recent activity.
3. **🔎 Seen before** — Loop searched the workspace and surfaces Dana's Northwind resolution (same
   `SAML assertion invalid` after a cert rotation).
4. **💡 Routing nudge** — "*Dana has handled more login / SSO handoffs — want me to loop them in?*"
   with a **Loop them in** button.
5. **📄 Live customer dossier** — link to the auto-created **canvas** (open it; it mirrors the brief).
6. **✍️ Draft a reply** button (next section).

Then demonstrate the actions:

### A. Auto-draft reply (the headliner)
- Click **✍️ Draft a reply**. Loop returns a concise, customer-ready reply grounded in the thread +
  the Salesforce case + the Northwind fix — e.g. it asks Acme to re-publish their IdP metadata and
  confirms you've cleared the cached cert.
- Click **📨 Post to thread** to drop it straight into `#cust-acme`, or **🔁 Regenerate** to try again.

### B. Loop in the expert
- Back on the brief, click **Loop them in** → Loop posts in the `#cust-acme` thread pulling **Dana**
  in, and records it (expertise keeps learning).

### C. Follow-up on the brief (context-aware)
- In the **brief DM**, reply:
  > what was the root cause on the Northwind one, and did we ever get a permanent fix?
- Loop answers *with the full handoff context* — it knows the case, the thread, and the prior
  resolution, and can search further with its Slack/Salesforce tools.

### D. Per-user memory + isolation
- **As Marcus**, DM the bot:
  > Hey, I'm Marcus — I own the Acme and Contoso accounts and I'm on-call this week.
- Bot replies. Now start a **new** DM message (or restart the app) and ask:
  > which accounts am I responsible for?
  → Loop recalls **Acme and Contoso** across the gap.
- **As Priya**, DM the bot:
  > what accounts does Marcus own?
  → Loop declines — it only recalls *your own* history, never another user's. *(the isolation point)*
- **As Marcus**, run `/forget-me` → memory cleared; ask again and it no longer remembers.

### E. Visibility
- Open the **Home** tab → dashboard: **🔁 Active customer threads** (`#cust-acme`, hot 🔥 after the
  loop-in), **🧠 Who knows what** (Dana — login / SSO), **🧾 Recent Salesforce cases** (`00012345`),
  and the **Connect Salesforce** button / status.
- Run `/customer-history` → the `#cust-acme` thread with its handoffs.

---

## Optional second case — Globex billing (variety)

In `#cust-globex` (invite the bot), as **Sam**:

**1.**
> Globex says their March invoice **double-charged** the annual plan — Salesforce **Case 00067890**.
> They're asking for a refund confirmation today.

**2.** *(handoff trigger)*
> @Marcus can you **handle** this billing one? You ran their renewal so you've got the context.

→ Brief shows `Case 00067890 · Globex (Standard) · Status: Open · 1 prior`, topic **billing**, and a
draft-reply button. Good for showing a non-escalated, different-topic flow.

---

## Live Salesforce

To run this against a **real** org instead of mock data, follow
**[DEMO_SALESFORCE.md](DEMO_SALESFORCE.md)** — it lists the exact Account / Case / Case Comments /
Task records and content to create, then have you use your org's real case numbers in the thread above.

---

## Pre-flight checklist

- [ ] Bot invited to `#cust-acme` (and `#support-archive`, `#cust-globex` if used).
- [ ] `ANTHROPIC_API_KEY` set (brief synthesis + classifier + draft).
- [ ] Slack **User OAuth Token** present and **Slack MCP** toggled on (App Settings → Agents & AI Apps)
      — required for **🔎 Seen before** and the **canvas**. Verify: `node scripts/slack-check.js sso`.
- [ ] Dana's expertise seeded (routing nudge).
- [ ] Northwind thread posted in `#support-archive` a minute early (so search indexes it).
- [ ] (Live SF only) `SALESFORCE_MCP_URL` set + the Appendix records created.
