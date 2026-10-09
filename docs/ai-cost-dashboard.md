# AI usage and cost dashboard — 2026-10-10

Settings → AI 이용량 shows account-owned AI calls by Korean calendar month (last 24 months), feature, and purpose. It is an application ledger, not a Google invoice integration. Storage, Firestore, Functions, other accounts, and scripts calling Gemini directly are excluded. Free quotas, credits and taxes are not deducted. The optional KRW rate is manually entered, not a live exchange rate.

## Measurement

- `trainerUsage` is authenticated, App Check enforced, deletion-lock aware and protected by the existing request guard. The authenticated UID determines scope; client-supplied identity cannot select another account.
- Reads `trainers/{uid}/aiCalls` for one month plus its monthly ledger and tracking setting. Returns aggregate counts, tokens, durations and estimated micro-USD only, never member data, prompts or raw model configuration.
- Completed and failed calls contribute to settled counts and average cost. Reserved calls appear separately and do not inflate spent cost or average. Unknown provider usage keeps the existing conservative charge and is explicitly flagged.
- Features include extraction, record analysis, goal/assessment, planning, direction discussion, basic/deep chat, and search/safety. Unknown historical models/kinds remain in a labeled fallback category.
- A question or uploaded page may produce multiple API calls. Search and retries are separate calls. The scenario calculator uses API-call counts and observed averages, not a claimed price per user, question or page. Missing samples produce no estimate.
- A report reads at most 10,001 call documents, aggregating the first 10,000. Incomplete scans show a warning and disable projections. Monthly cost not accounted for by available call records is shown separately.
- Filters use one returned report without additional queries. Opening the tab, changing month or explicitly refreshing loads the report; there is no polling. Each successful report therefore reads up to the bound above; aggregation adds no Gemini usage.

## Development classification

`trainers/{uid}/usageSettings/current.purpose` is server-managed. New calls snapshot `production` (default) or `development` inside their reservation transaction. This includes background extraction and analysis and adds one settings-document read per call. Switching the setting does not relabel in-flight or old calls. Old calls without metadata remain `unclassified`.

The setting labels usage only; it changes no model, budget, credentials, permissions or environment routing. Raw ledgers and settings remain inaccessible to direct client writes. Account deletion already recursively deletes these subcollections.

## Verification

- 116 Firestore emulator tests passed across service and usage reporting, including owner/month isolation, partial scans, pending/failed costs, KST boundaries and reservation-time purpose capture.
- 2 pure client tests cover currency, missing samples and month selection.
- Browser checks on synthetic data verified purpose filtering, manually entered KRW conversion, scenario calculation and missing-baseline handling. The table scrolls within its container on a 400px viewport.
- Temporary preview data is removed before deployment. No real Gemini calls or customer data changes were required for these checks.
