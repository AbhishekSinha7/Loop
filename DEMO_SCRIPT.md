# Loop — Demo Run-of-Show (3-minute video)

Users: **Sameed** (hands off), **Abhishek** = you (looped in — the account you screen-record),
**Sidra** (SSO expert). One channel: **#customer-support**. Message content is in
[DEMO_DATA.md](DEMO_DATA.md); this file is the *timing + who-does-what*.

---

## PART 0 — Stage this BEFORE you hit record (off camera, ~10 min)

Do all of this first so the recording is clean and everything "just appears."

1. **Salesforce data** — run [scripts/salesforce-demo-data.apex](scripts/salesforce-demo-data.apex);
   note the **Acme** case number from the log (e.g. `00001034`).
2. **App ready** — Loop installed in the workspace; in **Loop → Home**: API key added, Salesforce
   connected. Invite Loop to **#customer-support** (`/invite @Loop`).
3. **"Seen before" note** — as **Sidra**, post the Northwind note (DEMO_DATA §A) as its own thread.
   Wait a minute so Slack indexes it.
4. **Routing warm-up** — as **Sameed**, hand off 2 quick SSO threads to **@Sidra** (DEMO_DATA §2) so the
   brief will show the "loop in Sidra" nudge.
5. **Memory seed** — as **Abhishek**, DM Loop once: *"Hi, I'm Abhishek — I own the Acme and Globex
   accounts and I'm on-call this week."* (so the on-camera recall works).
6. **Stage the Acme thread context** — as **Sameed**, post messages **1 and 2** of DEMO_DATA §B in a new
   #customer-support thread (the situation + what's been tried). **Do NOT post message 3 yet** — that's
   your opening on-camera action.
7. Have two windows ready: **Sameed** in the channel, **Abhishek** (you) with the Loop DM open. Start
   your screen recorder on Abhishek's screen.

---

## PART 1 — RECORD THIS ▶️ (start here)

> **Where to start showing:** open on **#customer-support** with the Acme thread (messages 1–2)
> already visible. Your first on-camera action is Sameed posting the handoff line. The **brief DM
> (0:20–1:20) is the heart of the demo** — that's the part judges must see.

| Time | Screen | Action (who) | Say (voiceover) |
|---|---|---|---|
| 0:00–0:12 | #customer-support, Acme thread | — | "A customer's SSO is down. Support's been working it — then it gets handed off. Normally the next person starts from zero." |
| 0:12–0:20 | Acme thread | **Sameed** posts msg 3: *"…@Abhishek can you take this one and run with it?"* | "Sameed loops in Abhishek." |
| **0:20–1:20** | **Switch to Abhishek's DM from Loop — the brief** | *(brief appears automatically)* | **MAIN.** Walk the blocks: "Instantly, Loop DMs me a brief — the issue, what's been tried, the open question. The **live Salesforce case**: Acme, Enterprise, Escalated, prior cases, and the latest update. **'Seen before'** — it found the Northwind thread where we fixed this exact error. And it suggests looping in **Sidra**, our SSO expert." |
| 1:20–1:45 | Brief DM → channel | **Abhishek** clicks **✍️ Draft a reply** → **📨 Post to thread** | "One click drafts a customer-ready reply — grounded in the case and the past fix — and posts it to the thread." |
| 1:45–2:10 | Brief DM | **Abhishek** replies: *"what was the root cause on the Northwind one, and my next step?"* | "I can just ask follow-ups right here — it answers with full context, no 'catch me up.'" |
| 2:10–2:30 | DM with Loop | **Abhishek** DMs: *"which accounts am I responsible for?"* → then `/forget-me` | "It even remembers my own past conversations — privately. And I can wipe that anytime with /forget-me." |
| 2:30–2:50 | Loop → Home tab | **Abhishek** opens Home; run `/customer-history` | "A dashboard of active threads, who-knows-what, and recent cases." |
| 2:50–3:00 | Home / brief | — | "Loop — the teammate who's already read the thread." |

**Total: ~3:00.** If tight, cut 2:30–2:50 (App Home) — the brief + draft + follow-up are the core.

---

## What's the "main demo"?
The **handoff → brief** (0:12–1:20). If a judge watches only 60 seconds, they should see: someone
gets looped in, and Loop instantly hands them everything — synthesized issue, **live Salesforce**,
**"seen before,"** routing, and a **draft reply**. Lead with that; everything after is bonus.

## Optional second case (only if you have time)
As **Sameed**, hand off the Globex billing thread to **@Abhishek** (DEMO_DATA §G) to show a different
topic + case. Skip it in a 3-minute cut.
