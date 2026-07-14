# Loop — Submission Pack

Everything you need to fill the **Slack Marketplace** listing and the **Devpost** form.
Track: **Slack Agent for Organizations**. Deadline: **2026-07-13**.

---

## 1. Slack Marketplace listing copy

**App name:** Loop — Customer Whisperer

**Short description (≤ 140 chars):**
> When a customer thread gets handed off, Loop instantly briefs whoever's pulled in — the issue,
> the Salesforce case, prior threads, and a draft reply.

**Long description:**
> Customer handoffs in Slack lose context. The teammate pulled into a thread has to scroll the
> history, dig up the Salesforce case, and guess who's handled this before.
>
> Loop is an ambient agent that does it for them. The moment someone hands off a customer
> conversation ("@maria can you take this?"), Loop DMs that person a ready-to-act brief:
>
> • **What's going on** — the issue, what's been tried, and the open question, synthesized by Claude.
> • **Live Salesforce** — the case status, account tier, prior cases, and latest activity, pulled via
>   the Salesforce MCP server.
> • **"Seen this before"** — related prior threads from across your workspace, found via Slack search.
> • **Smart routing** — if a stronger expert has handled this topic, Loop offers to loop them in.
> • **A draft reply** — one click drafts a customer-ready response grounded in all of the above; edit
>   and post to the thread.
> • **A living dossier** — a per-thread canvas that updates as the conversation evolves.
>
> Loop also answers follow-up questions in the brief DM with full context, and remembers each user's
> own prior conversations. Every workspace runs on its own Anthropic key and connects its own
> Salesforce org; all data is encrypted and isolated per workspace, and deleted on uninstall.

**Category:** Customer Support (secondary: Sales)

**Key features (bullets for the listing):**
- Automatic handoff briefs in DM
- Live Salesforce case context (via MCP)
- "Seen this before" workspace search
- Expertise-based routing suggestions
- One-click AI draft replies
- Per-thread customer dossier canvas
- Per-user conversation memory + `/forget-me`
- Multi-tenant, encrypted, per-org Salesforce + Anthropic key

**Install / setup steps (for the listing):**
1. Add to Slack and authorize.
2. Open Loop's Home tab → **Add API key** (your Anthropic key).
3. Optional: **Connect Salesforce** for live case data (works with sample data otherwise).
4. Invite Loop to a customer channel and hand off a thread.

**Required URLs:**
- Privacy Policy: _(host [PRIVACY.md](PRIVACY.md) — e.g. GitHub Pages/gist — and paste the URL)_
- Support: er.abhisheksinha7@gmail.com
- Install: `https://loop-emsg.onrender.com/slack/install`

---

## 2. Devpost writeup

**Inspiration**
Support and sales teams live in Slack, and the worst moment in any customer conversation is the
handoff — the person pulled in has zero context and has to reconstruct it while the customer waits.
We wanted an agent that eliminates "can you catch me up?" entirely.

**What it does**
Loop watches customer channels. When a thread is handed to someone, it DMs them a brief: the
synthesized issue, live Salesforce case context, related prior threads found by workspace search, a
routing suggestion for the strongest expert, and a one-click AI-drafted reply. It keeps a living
canvas dossier per thread, answers follow-ups with full context, and remembers each user's own past
conversations.

**How we built it**
- **Bolt for JavaScript** for all Slack surfaces (events, actions, modals, commands, OAuth install).
- **Claude (Opus 4.8)** via the Anthropic SDK for handoff classification, brief synthesis, and reply drafting.
- **MCP** twice, through the Anthropic MCP connector: the **Salesforce** hosted MCP server for live
  case data, and the **Slack** MCP server for "seen this before" search and canvases.
- **Multi-tenant** from the ground up: libSQL/**Turso** data layer, per-workspace encrypted install
  tokens, per-org Salesforce connect (OAuth 2.1 + PKCE), and a per-workspace Anthropic key entered in
  the App Home Settings modal. Deployed on Render.

**Challenges**
Making agentic MCP calls fast enough for a Slack interaction (streaming + low effort), keeping every
enrichment step gracefully degradable so a brief always sends, and turning a single-workspace prototype
into a real multi-tenant app with encrypted, isolated per-org data and a durable free datastore (Turso).

**Accomplishments**
A genuinely ambient agent — not a chatbot you summon, but one that acts at the exact moment context is
lost — that's also a fully installable, multi-tenant, Marketplace-ready product.

**What we learned**
The MCP connector makes "bring your own SaaS data" surprisingly clean; and the hardest part of a Slack
agent isn't the AI, it's the multi-tenant plumbing (OAuth, encryption, isolation, uninstall hygiene).

**What's next**
Proactive SLA nudges for stale threads, sentiment/at-risk detection, a resolution knowledge base that
makes draft replies cite the known fix, and Salesforce write-back.

**Built with:** javascript, node.js, slack, bolt, anthropic, claude, mcp, salesforce, turso, libsql, render

**Required fields:** Slack App ID = _(from Basic Information, starts with `A…`)_ · Sandbox URL =
_(your dev sandbox)_ · Track = Slack Agent for Organizations.

---

## 3. Demo video script (~3 minutes)

Put the strongest thing (the brief) first — judges may stop at 3:00.

| Time | Scene | What to show / say |
|---|---|---|
| 0:00–0:20 | **Hook** | "Every customer handoff in Slack loses context. Loop fixes that — automatically." Show a busy customer channel. |
| 0:20–1:05 | **The core moment** | In a customer thread, type `@teammate can you take this? Case 00012345`. Cut to the teammate's DM: the brief appears — Issue / Tried / Open, the **Salesforce** case (Acme, Enterprise, Escalated, latest activity), **🔎 Seen before**, and the **routing nudge**. Narrate each block. |
| 1:05–1:35 | **Draft reply** | Click **✍️ Draft a reply** → the grounded reply appears → **📨 Post to thread**. "From looped-in to customer-answered, without leaving the DM." |
| 1:35–2:00 | **Follow-up + memory** | Reply in the brief DM: "what was the fix on the last Acme case?" → answered with context. Mention per-user memory + `/forget-me`. |
| 2:00–2:25 | **App Home** | Open the Home tab: active threads, who-knows-what, recent cases, Salesforce connected. |
| 2:25–2:50 | **It's a real product** | Show the install flow + Settings (Add API key) + Connect Salesforce modal. "Multi-tenant, encrypted, per-org — installable from the Slack Marketplace." |
| 2:50–3:00 | **Close** | "Loop — the teammate who's already read the thread." |

---

## 4. Security-questionnaire cheat sheet

Slack's review asks how you handle data. Answers, mapped to the implementation:

- **What Slack data do you store?** Installation tokens (encrypted), thread/channel IDs, handoff events,
  expertise counts, cached Salesforce case fields, per-user conversation turns (encrypted). No full
  message archives.
- **Where is it stored?** Hosted libSQL (Turso). Secrets encrypted at rest with AES-256-GCM.
- **Is data isolated per customer?** Yes — every row is scoped by Slack `team_id`; enforced in every query.
- **Third-party sub-processors?** Anthropic (LLM processing, per-workspace key), Salesforce (the org's
  own data via its own connection), Render (hosting), Turso (database).
- **Data retention / deletion?** Deleted on uninstall (`app_uninstalled` purges the workspace's data);
  users can erase their own memory via `/forget-me`; case cache expires in ~5 min.
- **Encryption in transit?** HTTPS everywhere.
- **Least privilege?** Scopes justified in [SCOPES.md](SCOPES.md); unused scopes removed.

---

## 5. Final submission checklist

- [ ] App lives in a **standard workspace** (not a Developer Sandbox).
- [ ] Latest code deployed to Render; `/health` returns `{"ok":true}`.
- [ ] Public Distribution activated; `/slack/install` works.
- [ ] Privacy Policy + Support URLs set on the app.
- [ ] Marketplace listing completed and **Submitted** (approval not required for the hackathon).
- [ ] Dev sandbox provisioned (event code), app installed there, **Anthropic key pre-set**, judges
      (`slackhack@salesforce.com`, `testing@devpost.com`) invited as Members.
- [ ] Demo video (~3 min) recorded.
- [ ] Devpost form: writeup, Slack App ID, sandbox URL, track = Organizations.
