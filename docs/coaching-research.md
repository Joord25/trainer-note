# Coaching analysis research

Member-change reanalysis and lesson suggestions share one report. New/retried analysis automatically runs public research before private synthesis; cached reads do not run research. Existing saved reports acquire research metadata on their next AI reanalysis.

## Source policy

`functions/coaching-research.mjs` owns the fixed HTTPS hostname allowlist: WHO, ACSM, NASM, NSCA, CDC, health.gov, KSSO, PubMed/PMC, BJSM, JAMA and LWW. Every redirect must remain on an allowed host; the initial Google grounding citation redirect is the only exception. Search results outside this list are discarded. Expand this list only after reviewing the institution/publisher and its URL ownership.

Domain membership alone is insufficient. A model classifies the retrieved document as research, systematic review, guideline or official educational guide. News, sales pages, advertisements, general blogs, unsupported documents, retracted papers and preprints are excluded by the extraction instruction. This semantic classification is not a peer-review or scientific-quality guarantee.

The server fetches public HTML (maximum 1.5 MB, bounded timeout), extracts up to 22,000 characters and verifies each short quote exactly against that text. PubMed uses the official NCBI EFetch API with a numeric PMID derived from a validated PubMed result URL; API redirects are disabled, the returned PMID is checked, and retracted-publication markers are rejected. It is labelled as abstract access. PDFs, paywalls and inaccessible pages are not bypassed or silently treated as verified. Model-generated source URLs are never accepted. `verified` means original text was retrieved and the excerpt matched, not that a personal prescription or every scientific claim is proven.

## Privacy and failure behavior

A private planning call converts the goal/trainer context into a general query. Name/ID checks plus the existing semantic privacy gate run before external search. The search transport reconstructs the request using only this public query and the fixed research policy, removing private records, history, images and supplied system text. Public source extraction has no member facts. Private synthesis then combines verified evidence with member records without any search tool.

Only server-verified WEB source IDs can enter the response schema and citation validation. Research failure returns an explicit status and uses the existing curated guidelines; it never widens to arbitrary websites or treats a missing search result as disproof. Research metadata and Google search suggestions are saved with the report, but search UI HTML is excluded from the synthesis input.

## Verification

- `node --test functions/tests/coaching-research.test.mjs functions/tests/web-search.test.mjs functions/tests/goal-decision.test.mjs`
- Workflow service tests require the Firestore emulator, including cache/stale/retry behavior.
- `node scripts/evaluate-coaching-research.mjs --live --firebase-key` exercises a public WHO topic against the configured provider; `--unknown` exercises a fictional claimed endorsement. These are opt-in paid tests and use no member records.
