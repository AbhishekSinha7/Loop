# Loop — Sub-processors

_Last updated: 2026-07-12_

This page lists the third-party sub-processors Loop ("Customer Whisperer") uses to process customer
data, in line with our [Privacy Policy](PRIVACY.md). We use the minimum set needed to run the app,
and each processes data only for the workspace it belongs to.

## Current sub-processors

| Sub-processor | Purpose | Data processed | Location |
|---|---|---|---|
| **Anthropic** (Claude API) | AI processing — handoff classification, brief synthesis, reply drafting, and the conversational assistant | Thread transcripts and assistant messages, sent using **each workspace's own Anthropic API key** | United States |
| **Turso** (libSQL) | Primary database — stores app data and secrets (encrypted at rest) | Slack tokens, thread metadata, expertise, cached Salesforce cases, per-user conversation memory, settings | AWS `ap-south-1` (Mumbai) |
| **Render** | Application hosting / compute | Processes requests in transit; no long-term data storage on the host | Singapore |

## Not a sub-processor

- **Salesforce** — when a workspace connects Salesforce, Loop queries that organization's **own**
  Salesforce data using the organization's **own** credentials. Salesforce is the customer's system
  of record, not a Loop sub-processor.
- **Slack** — Loop operates within the customer's own Slack workspace using that workspace's own tokens.

## Data protection

All secrets (Slack tokens, the workspace's Anthropic API key, Salesforce refresh token/secret, and
per-user conversation memory) are encrypted at rest with AES-256-GCM. All data is isolated per Slack
workspace (`team_id`), and all network traffic uses HTTPS/TLS.

## Changes

We may update this list as the service evolves; material changes are reflected by the "Last updated"
date above.

## Contact

Questions about sub-processors: **er.abhisheksinha7@gmail.com**.
