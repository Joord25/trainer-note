# AI usage and cost dashboard — 2026-10-10

Settings → 관리자 비용 is available only to the operator and shows project-wide application AI calls by Korean calendar month (last 24 months), feature, and purpose. It is an application ledger, not a Google invoice integration. Storage, Firestore, Functions, and scripts calling Gemini directly are excluded. Free quotas, credits and taxes are not deducted. The optional KRW rate is manually entered, not a live exchange rate.

## Measurement

- `trainerUsage` is authenticated, App Check enforced, deletion-lock aware and protected by the existing request guard. The authenticated UID must be in the server-managed `systemAccess/billing.uids` allowlist and have a verified email. The access action returns only a boolean. Every report and purpose change checks the allowlist again, so revocation takes effect without refreshing an ID token. No client can read or write the allowlist.
- Reads the `aiCalls` collection group for one month, keeping only canonical trainer-ledger paths; reconciles with the legacy `aiGlobalUsage/{month}` document plus its shards. Reads the operator’s tracking setting. The `month` collection-group index is deployed with this change. Returns aggregate counts, tokens, durations and estimated micro-USD only, never member data, prompts or raw model configuration.
- Completed and failed calls contribute to settled counts and average cost. Reserved calls appear separately and do not inflate spent cost or average. Unknown provider usage keeps the existing conservative charge and is explicitly flagged.
- Features include extraction, record analysis, goal/assessment, planning, direction discussion, basic/deep chat, and search/safety. Unknown historical models/kinds remain in a labeled fallback category.
- A question or uploaded page may produce multiple API calls. Search and retries are separate calls. The scenario calculator uses API-call counts and observed averages, not a claimed price per user, question or page. Missing samples produce no estimate.
- A report reads at most 10,001 call documents, aggregating the first 10,000. Incomplete scans show a warning and disable projections. Monthly cost not accounted for by available call records is shown separately.
- Filters use one returned report without additional queries. Opening the tab, changing month or explicitly refreshing loads the report; there is no polling. Each successful report therefore reads up to the bound above; aggregation adds no Gemini usage.

## Development classification

`trainers/{uid}/usageSettings/current.purpose` is server-managed. New calls snapshot `production` (default) or `development` inside their reservation transaction. This includes background extraction and analysis and adds one settings-document read per call. Switching the setting does not relabel in-flight or old calls. Old calls without metadata remain `unclassified`. Only an administrator can change their own tracking setting; other accounts keep the default.

The setting labels usage only; it changes no model, budget, credentials, permissions or environment routing. All usage ledgers (`aiUsage`, `aiDaily`, `aiCalls`) and tracking settings are inaccessible to direct client reads and writes. The old member-analysis cost display and listener have been removed. Account deletion already recursively deletes these subcollections.

## Verification

- 116 Firestore emulator tests passed across service and usage reporting, including owner/month isolation, partial scans, pending/failed costs, KST boundaries and reservation-time purpose capture.
- 2 pure client tests cover currency, missing samples and month selection.
- Browser checks on synthetic data verified purpose filtering, manually entered KRW conversion, scenario calculation and missing-baseline handling. The table scrolls within its container on a 400px viewport.
- Temporary preview data is removed before deployment. No real Gemini calls or customer data changes were required for these checks.

## Google billing comparison

Firebase and AI Studio can display costs for the same Google Cloud project and Gemini Developer API. Do not add their Gemini line items as separate services. Compare the same project, date range, API-key/model filters and reporting freshness. The app uses KST months, while the supplied Google charts use Pacific time. AI Studio's spend-cap month and selected 28-day chart can show different totals on the same page. Reporting can lag by a day or more; an exact difference cannot be attributed to lag without aligned billing data.

This dashboard is an operational estimate, not a billing sync. External scripts bypassing the app ledger remain outside the report even with project-wide aggregation. The user's administrator account was resolved through Firebase Auth and its UID was provisioned in a private allowlist; no email or UID is embedded in the public client bundle.

Admin revision validation: 102 targeted emulator/client tests cover access denial, forged role/UID inputs, verified-email checks, immediate revocation, project aggregation, legacy plus sharded totals, and rules blocking raw usage and allowlist access.
