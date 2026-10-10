# Settings and assistant update — 2026-09-14

## Assistant quality

`CHAT_QUALITY_PROMPT` separates the selected screenshot, dated training records,
and stored plans. Daily record groups are supplied with `orderKnown:false`; the
Firestore order is not claimed to be the exercise order. Inactive/error reports
are not treated as current evidence. An isolated upper-body day is not enough
to establish a split cycle or circuit method. Historical pain and unconfirmed
assessment drafts are not current clinical facts or agreed plans.

Answers have a short lead and optional structured sections. The server renders
these as headings/list items with real newlines, validates evidence IDs and
keeps source documents untrusted. This is prompt/context design, not model
fine-tuning or automatic training from every conversation.

When public research is needed, the search query remains anonymous and separate.
After search, a non-search model call joins public sources with member facts.
The added call is only used for searched answers. If it fails, the sourced search
result remains visible with a notice. Account counters include every paid call.

## Account deletion

`trainerAccount` requires App Check, an authenticated owner, explicit confirmation
and `auth_time` within five minutes. The UI uses Google reauthentication.
No account can be selected by a client-supplied UID.

1. Write a server-only `accountDeletions/{uid}` lock. Rules reject existing tokens;
   new AI endpoints, storage events, record events and report tasks stop.
2. Enqueue `purgeTrainerAccount` after 210 seconds (existing AI functions timeout
   at 180 seconds), then delete the Firebase Auth user. Google itself is untouched.
3. The task deletes Auth idempotently, all objects under `trainers/{uid}/`, and the
   entire Firestore trainer document and every nested collection, including
   members, imports, records, goals, chats, captures, usage and feedback.
4. A UID-only operational lock remains until 65 minutes after the request so old
   ID tokens cannot recreate deleted data. The release task then deletes it.
   Cleanup failure keeps the lock and retries up to ten times; monitor failed
   task logs/queues. Provider backups and Storage retention follow project policy.

Deploy the rules and all affected functions together. Never test deletion against
an actual member account. Emulator tests use fake Auth/Storage dependencies and
confirm foreign accounts remain intact.

## Developer feedback

The button sends the entered topic, message and optional contact to
`trainers/{uid}/feedback/{requestId}` (admin/developer inbox in Firestore).
The browser receives a receipt ID and clears the message only after success.
Same-ID retries are idempotent; new submissions have a 30-second throttle.
No member records/screenshots are auto-attached, and no email service is claimed.
Operators can inspect the `feedback` collection group in Firebase Console.

## Display

Per-account local preferences include light/dark/system, original/system font,
base text scale, 2-view and 3-view ratios, card size and member ordering. Ratios
apply to open workspaces; the default view count applies when a workspace opens.
The card-size preview is removed. System-theme changes are observed live.
Dark mode follows the supplied Univ AI reference: neutral near-black/charcoal
panes, bright body text, muted secondary text and green reserved for selections.
Original/records/analysis/lesson/assistant panes, chart hit areas/tooltips and
goal/settings dialogs were inspected in the browser; light mode remains intact.
Original images and PDF canvases are not color-inverted. Reduced-motion OS
preference is honored. Display reset restores all defaults.

## Usage and beta measurement

The account UI shows the Korean-calendar month. `calls` means API attempts,
including preflight failure, search safety, search, and synthesis. Cached results
are reused without new calls. Input/output tokens come from Gemini usageMetadata;
output includes billed thinking tokens when reported. Failed calls can be billed.

The app estimates model cost at $0.25 / million input tokens and $1.50 / million
output tokens, plus conservative search charges. These rates match the published
[Gemini model information](https://deepmind.google/models/model-cards/gemini-3-1-flash-lite/).
See [current pricing](https://ai.google.dev/gemini-api/docs/pricing).
This is not a Google invoice sync: free tiers, credits, taxes, currency conversion,
other project users, servers and storage are outside the estimate. Unknown usage
uses the reserved ceiling and marks the call uncertain.

New calls also store duration, completion/failure, model, call kind and guidance
version. Historical counters are not relabeled as historical success counts.
For beta review, run the read-only operator script with application-default
credentials:

```
node scripts/summarize-ai-usage.mjs PROJECT UID YYYY-MM
```

Review attempts, failures, tokens and estimated cost by call kind; compare median
and p95 latency, and isolate first file parsing from ordinary chat/cache reuse.
Use at least several real test sessions before estimating typical daily usage.
The script prints aggregate metrics only, never diary text or prompts.

## Validation

344 server/emulator tests passed, including deletion isolation and locked-account
rules. Production build and TypeScript completed. Synthetic Gemini program
questions returned structured grounded answers in roughly 2–3 seconds (three
cases, not a production latency guarantee). Firebase functions and Firestore/
Storage rules were deployed. No real account deletion or feedback submission
was performed during QA.

## Search capability routing fix

Standalone questions about whether web search is available receive the app's
actual capability description without invoking Gemini or public search. Topic
requests still use the existing anonymous query validation, semantic safety gate,
grounded search and private synthesis stages. Failed searches discard the
pre-search draft so users never receive a stale promise or a false claim that
search is unavailable. Existing saved answers require regeneration.

Validation: 103 targeted server/search tests passed. A public-only ACSM query
passed the safety gate and returned six grounded sources in 3.9 seconds; no
member data or captures were used. This is a connectivity check, not a latency
or answer-quality guarantee.

## 모델 선택 및 읽기 UI (2026-10-10)

- 사용자 표시: 기본 모델 / 고급 모델. 기존 API 및 저장 데이터의 `quick` / `deep` 값은 유지한다.
- 현재는 두 모드 모두 기존 이용 권한으로 사용할 수 있다. 사용자가 요청한 **추후 고급 모델 유료 전용 전환**은 결제 연동 시 적용한다. 실제 결제/권한 기능이 없는 상태에서 작동하지 않는 업그레이드 버튼을 표시하지 않는다.
- 유료 전환 시 서버가 관리하는 구독 권한을 사용하고, `chat` 및 답변 재생성·재시도 경로에서 모델 호출 전에 검사해야 한다. 프런트엔드에서 버튼만 잠그는 것으로 대체하지 않는다. 구독 취소·만료·다운그레이드와 관리자 테스트 권한도 함께 검증한다.
- 출처 번호는 해당 답변의 검증된 HTTPS 웹 출처에만 연결한다. 마우스/키보드 도움말에서 제목·도메인을 보여주며 실제 사이트 내용을 새로 수집하지 않는다. 회원 기록 출처와 웹 출처는 구분한다.
- 회원 변화 목차는 실제 보고서 제목에서 생성하며, 읽고 있는 섹션을 표시하고 해당 패널 안에서만 이동한다.
