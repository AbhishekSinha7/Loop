# Loop — Demo Data & Script (Salesforce + Slack)

Everything to show **all** of Loop's features live. ~10 minutes of setup.

## 1. Salesforce (automated)

Run [scripts/salesforce-demo-data.apex](scripts/salesforce-demo-data.apex):
**Developer Console → Debug → Open Execute Anonymous Window** → paste the file → check
**Open Log** → **Execute**. In the log, find the lines starting with `>>> CASE` and note the
**Acme** and **Globex** case numbers (Salesforce assigns them, e.g. `00001034`).

That script creates: Acme Corp (Enterprise) with the flagship SSO escalation + 3 case comments +
an open task + 4 prior cases, a resolved Northwind case, and a Globex billing case.

> Skipping live Salesforce? Loop falls back to rich **mock** data for case `00012345` (Acme) and
> `00067890` (Globex) — the brief still works. But for judging, live data is the stronger demo.

## 2. Slack setup (one-time)

- Create one channel **#customer-support**. Invite Loop: `/invite @Loop`. Keep each scenario in its
  **own thread** (a new top-level message per scenario) — Loop tracks threads independently, and "seen
  before" searches the whole workspace, so a single channel is all you need.
- You'll @mention a few teammates. Substitute real people in your workspace for **@Sameed** (owner),
  **@Abhishek** (looped in), **@Sidra** (SSO expert). In a small sandbox, two users is enough.

### (Optional) make the routing nudge fire
Loop suggests an expert once someone has handled that topic more than the person being looped in.
Easiest reliable way: do **2 quick warm-up handoffs to @Sidra** on SSO threads first, so Loop learns
Sidra is the SSO expert. In **#customer-support** (each as its own short thread):

> **@Sidra** can you take this SSO one? Customer's SAML login is failing.

(reply in that thread, then repeat once more in a new thread). Now the real handoff below will offer
to loop in Sidra.

## 3. The demo, step by step

Replace `00001034` with your **real Acme case number** from step 1.

### A. The "seen before" source — post in **#customer-support** as its own thread (as @Sidra)
```
✅ [Resolved] Northwind SSO — users hit `SAML assertion invalid` right after they rotated their SAML
signing cert. Root cause: the IdP-side signing certificate fingerprint wasn't updated, so our SP
rejected the assertion. Fix: had them re-publish the IdP metadata and we cleared the cached cert in
our SSO config — back up in ~20 min. — Sidra
```
_(This is what Loop's 🔎 "Seen before" search finds. Post it a minute before the handoff so it's indexed.)_

### B. The handoff — post in **#customer-support** as a new thread (as @Sameed), messages 1→3 in that thread
```
1. 🔴 Acme Corp can't log in via SSO since ~8am — users get `SAML assertion invalid` right after the
   IdP redirect. Started right after we rotated their SAML signing certificate last night.
   Salesforce Case 00001034.

2. Checked so far: re-uploaded the new signing cert, confirmed their ACS URL and Entity ID are
   unchanged, and validated the IdP metadata XML parses. Error still fires for every user.

3. It's their Enterprise SSO so all ~200 Acme users are locked out — already escalated. I've got
   another P1 starting now. @Abhishek can you take this one and run with it?
```
➡️ **Message 3 fires the handoff.** @Abhishek gets a DM brief with: Issue / Tried / Open, the
**Salesforce** case (Acme · Enterprise · Escalated · prior cases · latest comment), **🔎 Seen before**
(Northwind), the **routing nudge** (if warmed up), a **✍️ Draft a reply** button, and the canvas link.

### C. Draft reply (in @Abhishek's brief DM)
Click **✍️ Draft a reply** → a customer-ready reply appears → **📨 Post to thread** (or **🔁 Regenerate**).

### D. Follow-up with context (reply in the brief DM)
```
what was the root cause on the Northwind one, and what's my next step here?
```
➡️ Answered with the full handoff context (no "catch me up").

### E. Loop in the expert
If the nudge appears, click **Loop them in** → Loop pulls @Sidra into the Acme thread.

### F. Conversational agent + memory (DM the Loop bot directly)
```
1. Hey, I'm Abhishek. I own the Acme and Globex accounts and I'm on-call this week.
2. (Loop replies)
3. which accounts am I responsible for?      ← Loop recalls "Acme and Globex"
4. /forget-me                                 ← erases your stored memory
```

### G. Second flow — Globex billing (post in **#customer-support** as a new thread)
```
1. Globex says their March invoice double-charged the annual plan — Case 00001040. They want a refund
   confirmation today.
2. @Abhishek can you handle this billing one? You did their renewal.
```
➡️ Brief with the Globex case (Standard · Open), different topic (billing).

### H. Visibility
- **`/customer-history`** → recent customer threads + who was looped in.
- Open **Loop → Home tab** → active threads, "who knows what", recent Salesforce cases, connection status.

## 4. Feature → demo-step map

| Feature | Step |
|---|---|
| Handoff detection + brief | B (msg 3) |
| Claude brief synthesis (Issue/Tried/Open) | B |
| Live Salesforce case + latest activity | B (Apex data) |
| 🔎 Seen before (Slack MCP search) | A + B |
| Expertise routing nudge | warm-up + B/E |
| ✍️ Auto-draft reply | C |
| Context-aware follow-ups | D |
| Loop-in-expert | E |
| Conversational agent + per-user memory + /forget-me | F |
| Second case / topic | G |
| /customer-history + App Home dashboard | H |
