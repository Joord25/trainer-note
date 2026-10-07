# Assistant and coaching workspace verification — 2026-10-08

## Changes

- Separate hypothetical examples, general explanations, current member records, and selected-image reading. Explicit requests for current exercise records restore the record context after a hypothetical conversation.
- Read the selected capture without unrelated dates, stored plans, or earlier examples. Preserve visible exercise names and do not invent missing sets, repetitions, or weekly frequency.
- Explain confirmed changes and their meaning, with practical conditional coaching examples. Unrecorded resistance is not bodyweight, zero resistance, or evidence of increased load.
- Honor requests for a single sentence through the response schema, including after web-search synthesis.
- Retain server-selected basic/deep modes while withholding implementation details from client answers and metadata. Deny client reads of internal AI call documents.
- Use shared analysis/period controls in both workspace layouts; align journey summary styling; scroll the chat immediately when the question is submitted.
- Preserve mixed bodyweight/weighted sets through extraction, validation, storage, analysis, and editing. Keep lesson-plan proposals reviewable before saving.

## Automated verification

- Full Firestore/Storage emulator suite: **479 passed, 0 failed, 1 skipped** (480 total). The skipped case is the opt-in 1,000-account accounting load test.
- TypeScript check and `git diff --check`: passed.
- Conversation fixture runner: 10 context checks passed without a model call.
- Additional anonymous trainer-question runner: nine fixtures covering changes, absent exercises, terminology, missing resistance, program composition, saved directions, brevity, mixed private/public questions, and capture reading.
- Service regression confirms that a capture question includes the selected image while excluding unrelated member records and plans.

## Live answer review

Both answer modes were exercised with anonymous synthetic inputs. Reviews included volume vs. capacity, recent vs. initial change, historical symptoms vs. current status, hypothetical follow-ups, switching back to actual-record questions, existing treadmill interval structure, unavailable records, saved directions, missing resistance, and program composition.

Targeted rechecks confirmed:

- Current treadmill-record questions leave hypothetical context and refer to supplied interval segments.
- A synthetic image containing `Band ex / Lunge / One leg up (Stair-up)` produces all three exercise items without unrelated dates or invented repetition counts.
- Missing resistance no longer establishes added weight in the final targeted examples.
- Both modes return a single sentence with 600 kg·repetitions for the synthetic 20 kg × 10 × 3 request.

These are reviewed examples, not a claim that all generated answers are error-free. Some earlier runs used imprecise intensity/density language and repeated conclusions. General terminology and response phrasing remain probabilistic; the fixture scripts preserve the review criteria for future changes.

## Deployed UI and data checks

- Firebase Hosting, Functions, and Firestore rules deployment completed.
- Production 2-view and 3-view analysis controls have matching button dimensions and typography; period controls use the same shared component.
- Member-change, next-period-direction, and lesson-plan record summaries have matching computed background, border, spacing, and text size.
- Production basic and deep submissions show the pending question with an empty composer and a bottom scroll gap of 0–1 px while generation is still in progress.
- Removed obsolete model metadata from 23 existing chat documents; a read-only follow-up scan found zero remaining model fields in 65 chat documents. Questions, answers, and workout records were preserved.

## Boundaries

- Original member screenshots were not resent to an external AI provider for this verification. External retransmission was rejected by automatic approval review because the image could contain private member information. Synthetic image testing and service-level image routing checks do not establish handwriting accuracy on the original image.
- Previously saved answer text is not rewritten by deployment. Use a new question or regenerate an answer to apply the current behavior.
- Application output filtering does not make source code private. The existing GitHub repository is public; repository visibility is a separate owner decision.
- Development App Check access remains as requested during the testing phase; the existing production-transition checklist still applies at launch.
