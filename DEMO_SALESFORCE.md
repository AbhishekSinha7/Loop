# Loop — Live Salesforce Demo Build Sheet

Create these records in your Salesforce org so Loop pulls **real** case context (status, account
tier, prior-case count, and the *latest activity* from Case Comments / Tasks) — no mock data. Then
run the Slack flow in [DEMO.md](DEMO.md) using the **case numbers your org actually assigns**.

> ⚠️ **Salesforce assigns Case Numbers automatically** (e.g. `00001034`). You can't set them to
> `00012345`. After creating each case, **copy its real Case Number** and use that in the Slack
> thread (write it as `Case 00001034` so Loop's parser always catches it).

---

## 0. Point Loop at your org (once)

Set these in `.env` (see [SALESFORCE_SETUP.md](SALESFORCE_SETUP.md) for the full walkthrough):
```
SALESFORCE_MCP_URL=https://<your-hosted-mcp-endpoint>
SALESFORCE_LOGIN_URL=https://<yourdomain>.my.salesforce.com
SALESFORCE_CLIENT_ID=<External Client App consumer key>
SALESFORCE_REFRESH_TOKEN=<from: node scripts/sf-mcp-login.js>
```
**Verify the live path before touching Slack** (this calls the org directly):
```sh
node scripts/sf-test.js 00001034        # use your real Acme case number
```
You should see real `accountName / accountTier / status / priorCases / recentActivity` and
`mock: false`. If that works, the Slack brief will too.

---

## 1. Account tier values (one-time field setup)

Loop reports an "account tier" — it reads the Account **Type** field. Add two picklist values so the
story reads cleanly:

**Setup → Object Manager → Account → Fields & Relationships → Type → (Picklist Values) New** → add:
- `Enterprise`
- `Standard`

---

## 2. Create the Accounts

**App Launcher → Accounts → New:**

| Account Name | Type | Description |
|---|---|---|
| **Acme Corp** | `Enterprise` | Enterprise customer. SSO via SAML (their IdP). ~200 seats. |
| **Globex** | `Standard` | Standard plan, annual billing. |

(Putting "Enterprise"/"Standard" in both the **Type** field *and* the Description makes the lookup
robust regardless of which field the MCP returns.)

---

## 3. Create the prior cases (drives the "N prior cases" count)

Loop reports how many **other** cases exist on the account. Create these as **Closed**:

**On Acme Corp — create 4 closed cases** (Subjects can be anything realistic):
1. "Password reset emails delayed" — Status **Closed**
2. "API rate limit increase request" — Status **Closed**
3. "Add SSO test user to sandbox" — Status **Closed**
4. "Billing contact update" — Status **Closed**

**On Globex — create 1 closed case:**
1. "Seat count question" — Status **Closed**

> Tip: from the Account page → **Cases** related list → **New** keeps the Account pre-filled.

---

## 4. Create the main Case #1 — Acme SSO escalation

**From Acme Corp → Cases → New:**

| Field | Value |
|---|---|
| Account Name | **Acme Corp** |
| Status | **Escalated** |
| Priority | **High** |
| Subject | `SSO login failing — "SAML assertion invalid" after signing-cert rotation` |
| Description | `All ~200 Acme Enterprise users get "SAML assertion invalid" immediately after the IdP redirect, starting right after Acme rotated their SAML signing certificate overnight. Re-uploaded the new cert on our side; ACS URL and Entity ID unchanged; IdP metadata XML parses. Error still fires for every user.` |

**➡️ Copy the Case Number it generates** (e.g. `00001034`). This is your **Acme case number** for Slack.

---

## 5. Add Case Comments to Case #1 (the "latest activity")

On the case → **Related** tab → **Case Comments** → **New**. Add these **in order** (the newest is the
one Loop surfaces as *Latest:* in the brief):

1. `Customer rotated their SAML signing cert last night; SSO broke at ~08:00. Re-uploaded the cert on our side and confirmed the ACS URL is unchanged.`
2. `Escalated — all ~200 Enterprise users locked out. Paged the escalation owner.`
3. `Customer replied 1h ago: the error still persists after the cert rotation. Next step is to have them re-publish their IdP metadata. Awaiting confirmation.`

---

## 6. Add an open Task to Case #1 (shows an open follow-up)

On the case → **Activity** → **New Task**:

| Field | Value |
|---|---|
| Subject | `Follow up: have Acme re-publish IdP metadata, then clear our cached cert` |
| Due Date | **today** |
| Status | **Not Started** (i.e. open) |
| Related To | the Acme case |

---

## 7. (Optional) Chatter post on Case #1 — extra richness

On the case feed, post:
> Escalation owner paged. Strong match to the Northwind case last month — suspect the IdP-side signing
> certificate fingerprint wasn't updated. Plan: Acme re-publishes IdP metadata, we clear the cached cert.

---

## 8. Create the main Case #2 — Globex billing (optional second flow)

**From Globex → Cases → New:**

| Field | Value |
|---|---|
| Account Name | **Globex** |
| Status | **Open** |
| Priority | **Medium** |
| Subject | `Double charge on March annual-plan invoice — refund requested` |
| Description | `Globex's March invoice charged the annual plan twice. Customer wants a refund confirmation today.` |

**Case Comment:** `Agent left an internal note yesterday; awaiting customer confirmation of the duplicate charge before issuing the refund.`

**➡️ Copy this Case Number** too (your **Globex case number**).

---

## 9. Run the Slack demo with the real numbers

Now follow **[DEMO.md](DEMO.md)** exactly — with one substitution: wherever it says `Case 00012345`
or `Case 00067890`, use **your org's real case numbers** from steps 4 and 8.

Everything else in DEMO.md is Slack-side and unchanged:
- The **Northwind "seen before" thread** in `#support-archive` is a *Slack* message (not Salesforce) —
  still post it; it's what the **🔎 Seen before** search finds.
- Expertise seeding, the handoff line, draft reply, follow-up, memory, App Home, `/customer-history`,
  `/forget-me` all work the same.

After the first handoff runs, the live case also appears under **🧾 Recent Salesforce cases** in App
Home with **no _(mock)_ tag** — proof you're on live data.

---

## Feature → live-data mapping

| Brief / feature shows… | …because you created |
|---|---|
| `Acme Corp (Enterprise)` | Account **Type = Enterprise** (step 1–2) |
| `Status: Escalated` | Case **Status = Escalated** (step 4) |
| `4 prior case(s)` | 4 closed cases on Acme (step 3) |
| `_Latest:_ …re-publish their IdP metadata…` | newest **Case Comment** (step 5) + open **Task** (step 6) |
| **🔎 Seen before** (Northwind) | the Slack `#support-archive` thread (DEMO.md setup) |
| **✍️ Draft a reply** citing the IdP-metadata fix | thread + the case comment/task + the Northwind thread together |
| App Home **Recent Salesforce cases**, no _(mock)_ | the live lookup caching the real case |

---

## Quick checklist

- [ ] `.env` Salesforce vars set; `node scripts/sf-test.js <ACME_CASE#>` returns `mock: false`.
- [ ] Account **Type** picklist has `Enterprise` / `Standard`; Acme = Enterprise, Globex = Standard.
- [ ] 4 closed cases on Acme, 1 on Globex.
- [ ] Acme SSO case: Status **Escalated**, 3 Case Comments, 1 open Task. Case number noted.
- [ ] Globex case created, number noted.
- [ ] Slack: bot invited, Northwind thread posted, Dana's expertise seeded, User token + MCP on.
- [ ] In the Slack thread, reference **your real** `Case <number>`.
