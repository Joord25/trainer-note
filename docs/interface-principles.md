# Trainer Note 인터페이스 원칙

2026-09-12 — 사용자가 공유한 Apple 디자인 원칙과 아래 공식 HIG의 사이드바, 모션, 소재, 접근성 항목을 검토해 웹 작업실에 적용했다. HIG 전체를 검토하거나 모델을 학습시킨 것은 아니다.

## 우선순위

1. **기록과 작업이 먼저.** 회원 목록 → 원본·기록 수정 → 진행 분석·다음 수업이라는 현재 구조를 유지한다. 제목은 작업 이름으로 쓴다. 반복적인 소개 문장과 사용법을 없애고 버튼 이름·선택 상태·편집 아이콘으로 다음 행동을 드러낸다.
2. **내비게이션은 접을 수 있게.** 데스크톱 사이드바는 240px / 64px. 접힌 상태에서도 회원 목록, 회원 선택, 회원 관리, 계정 설정에 접근한다. 회원 등록과 검색은 회원 홈에 모으고 사이드바에서는 중복 표시하지 않는다. 아이콘에는 접근성 이름과 마우스 툴팁을 제공한다. 설정은 현재 브라우저의 로그인 계정별로 저장한다.
3. **작은 화면에서는 콘텐츠 폭을 지킨다.** 850px 이하에서는 64px 레일을 기본으로 사용하고 펼친 메뉴는 오버레이로 보여준다. 데스크톱의 저장된 접힘 설정은 바꾸지 않는다. 배경 클릭·Escape로 닫고, 열려 있는 동안 배경은 inert 처리하며 Tab 이동은 메뉴 안에 머문다.
4. **필요한 정보는 없애지 않는다.** 판독 불확실성, 집계 제외, 분석 범위, 출처, 미저장 상태, 오류·오프라인 상태, 수업 초안 표시는 판단과 복구에 필요하다. 긴 부가 정보는 접기/펼치기로 제공한다. 정상 연결 표시는 생략하고 오프라인·오류 안내는 본문에 남긴다.
5. **동작은 상태 전환을 설명한다.** 사이드바 폭은 200ms, 설정 진입은 160ms의 짧은 전환. 이 수치는 Apple 의무 규격이 아니라 이 서비스에 선택한 값이다. 반복·튀는 효과는 피한다. `prefers-reduced-motion`에서는 전환과 애니메이션을 끈다.
6. **소재는 계층을 구분하는 용도.** 원본·표·본문은 불투명한 배경을 유지한다. 사이드바에는 옅은 별도 배경, 설정 창에는 배경 차광을 사용한다. 이미 있는 설정 배경 흐림은 투명도 줄이기 설정에서 제거한다. 네이티브 Liquid Glass를 웹에서 그대로 구현했다고 표현하지 않는다.

## 이번 적용과 확인

- 홈·판독 표·부위 분포·변화 추이·다음 수업·설정·도우미의 반복 문구 축소.
- 사이드바를 접거나 펼쳐도 작업실을 다시 마운트하지 않아 편집 중인 수업 내용 유지.
- 코드 빌드 및 실제 컴포넌트를 사용하는 브라우저 확인. Firebase 입출력은 테스트에서만 대체했으며 회원 데이터 변경과 유료 AI 호출은 하지 않았다.
- 데스크톱 폭, 접힘 저장, 계정별 분리, 모바일 메뉴, 키보드 포커스, 배경 클릭, 동작 줄이기를 확인한다.

## 후속 화면에도 적용할 기준

- 복잡한 판독 예외를 일반 안내 문장과 함께 숨기지 않는다.
- 드래그·올가미 같은 제스처는 눈에 보이는 버튼도 함께 제공한다.
- 자동 처리 중에는 실제 처리 단계와 재시도 행동을 보여주고 임의의 진행률을 만들지 않는다.
- 새로운 테마/유리 효과는 대비와 원본 가독성을 먼저 검증한다.

## 공식 참고 자료

- [시작하기](https://developer.apple.com/kr/design/human-interface-guidelines/getting-started) — 한국어 페이지 본문은 자바스크립트 렌더링으로 도구에서 제한되어 사용자 제공 원칙과 공식 영어 개별 항목을 함께 확인했다.
- [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles)
- [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)

### 사이드바 밀도 조정

접힌 레일의 상단은 단일 버튼이다. 기본 `tn.` → hover/키보드 focus 시 펼치기 아이콘으로 교체하며 터치 기기에서는 아이콘을 바로 표시한다. 펼친 사이드바의 중복 회원 제목·검색·등록·정상 연결 표시는 제거했다. 홈 상단 패딩은 16px, 사이드바 상단은 12px로 줄였다.

### 작업실 공통 제목 바

원본·작업·AI 도우미 위에 54px 제목 바를 둔다. 왼쪽은 회원 목록으로 돌아가기, 가운데는 회원 이름·운동 기록, 오른쪽은 2뷰/3뷰 전환이다. 중앙 작업 탭에서는 뷰 전환을 중복 표시하지 않는다. 제목은 긴 경우 생략하고 전체 이름은 툴팁으로 제공한다. 작은 화면의 AI 도우미는 제목 바 아래에 표시한다. 돌아가기는 기존 회원 홈 동작을 사용해 작성 중인 작업실을 유지한다.

### 회원 작업 메뉴와 포커스

별도 회원 관리 카드를 두지 않고 현재 회원 항목의 ⋯ 버튼 아래로 수정·일지 추가·삭제를 모은다. 메뉴는 바깥 클릭이나 Escape로 닫고, 삭제 가능 조건은 기존대로 유지한다. 검색 포커스는 입력 요소 대신 아이콘을 포함한 검색창 전체에 표시한다. 회원 카드는 hover 시 4px 떠오르며 동작 줄이기 설정에서는 위치 이동을 생략한다.

### 모든 회원 메뉴와 패널 복원

홈 카드의 이름 옆과 모든 사이드바 회원에 ⋯ 메뉴를 제공한다. 접힌 사이드바는 이니셜을 hover/focus 시 ⋯로 바꾸고, 클릭하면 레일 폭을 유지한 채 옆으로 네이티브 popover를 연다. 메뉴는 수정·일지 추가·삭제를 공통으로 사용하고, 접힌 레일에서는 운동 기록 열기도 제공한다. 카드의 이동 버튼과 메뉴 버튼은 서로 중첩하지 않는다.

삭제는 확인창을 거치며 기존 서버의 빈 회원 삭제 조건을 유지한다. 연결된 일지·기록이 있으면 삭제를 비활성화하고 이유를 표시한다. 연결 자료까지 일괄 삭제하는 서버 기능은 이번 UI 변경에 포함되지 않는다.

접힌 원본은 오른쪽 화살표의 원본 펼치기 버튼으로, 닫힌 도우미는 AI 도우미 버튼으로 복원한다. 도우미와 원본은 닫을 때 제거하지 않아 입력과 뷰어 상태를 유지한다.

## Page-linked record review (2026-09-12)

- Original reopening uses the mirrored collapse chevron alone. The assistant reopen button points right.
- Clicking a source page locates its file/page in record correction; selecting a record opens that exact source page. The duplicate source-link action above the paper is removed.
- Each paper groups records by source file and physical page. A date control explicitly applies to that page, including manual records; different existing dates require confirmation. Other pages stay unchanged, and unrelated review warnings remain unresolved. All writes use a revision fence and one transaction.
- Missing source years default to the current Korean calendar year on new imports. Original explicit years win, and the applied default is preserved in notes. Existing imports without a year receive the same default without another model read. The default remains adjustable; explicitly corrected page dates and individually confirmed dates survive later year changes.
- One checklist combines ambiguous records and unparsed source text. Each item opens the source page and inline correction. A footer adds an exercise linked to that page. Resolving unparsed text atomically adds the record and removes the checklist entry, including after later year changes.
- Analysis options provide text scaling (100–200%), clipboard copy, PDF through the browser print dialog, and explicit regeneration. Regeneration uses a new cache generation under the analysis namespace and the existing quota checks; it never rereads the source or overwrites a saved trainer lesson plan.
- Proposed next data-model change, not enabled yet: represent unilateral repetitions as left/right counts on one set, e.g. `좌 10 / 우 10`, with the load basis recorded separately. Keep one exercise and one bilateral round rather than silently converting to 20 reps or two exercises. Compute comparisons only with compatible side/load conventions. Ambiguous `LR 10` remains a review item until the trainer confirms whether it means each side or total.

## Visual source navigator and record cards (2026-09-12)

The source toolbar opens a thumbnail rail instead of an operating-system file-name select. Image files have one thumbnail; PDFs have one per physical page. Thumbnails reuse the viewer's loaded Blob/PDF document and render nearby canvases only. Selecting one moves to the matching original and record page. The rail can be collapsed to restore reading width.

A record paper includes its original file name in the heading and opens that original from any non-interactive card area (or Enter/Space on the focused card). Inputs and correction buttons keep their own actions. The repeated member-name/count strip is removed; the exercise count appears beside the exercise-list heading.

## Proposed distance/time records and trainer explanations

This proposal is not an implemented record-schema change. The current kg/reps schema cannot represent a SkiErg 200 m interval completed in 32 s. More prompting alone cannot fix this constraint.

1. Introduce a versioned, discriminated measurement kind: repetitions, distance/time, duration, distance, and eventually calories. For distance/time, store each interval's distanceMeters and durationSeconds separately, plus optional restSeconds and equipment/resistance notes. Preserve the original strings and source page. Never turn 200 m into 200 kg or 32 s into 32 reps.
2. Let the trainer confirm `sky erg` as `SkiErg` for their own workspace. Ask when ambiguous: fixed distance or fixed time, units, interval/rest structure, machine/drag factor, and the intended training task. Do not infer these from a machine name alone.
3. From an unparsed item, provide an explanation action in the assistant, linked to that exact source page. The assistant proposes a structured correction; the trainer checks the values before saving. Save an approved interpretation rule separately from free-form chat, with trainer scope, original evidence, revision, and an edit/remove action. Do not automatically turn every chat sentence into a permanent rule.
4. Supply relevant saved explanations to subsequent extraction and report requests. This is saved context/retrieval, not automatic retraining of Gemini weights. Apply a one-session intent to that session; apply a trainer-wide abbreviation only when that scope was explicitly selected. A later source value overrides an old default.
5. Compare like-for-like intervals: same equipment, distance, resistance and rest conditions. Show time, pace and completion separately from weighted volume. Missing comparison conditions trigger a follow-up question; neither faster completion nor the machine name alone establishes physiological improvement.

Reference: Concept2 PM5 documentation describes fixed distance/time workouts and results/splits: https://www.concept2.com/support/monitors/pm5/how-to-use

For popup authentication the app returns `Cross-Origin-Opener-Policy: same-origin-allow-popups`. A Google/Firebase popup's own report-only diagnostics can still appear independently of whether login completes. Do not silence console errors or disable Auth/App Check to address a transport failure. Verify the actual callable URL and its preflight response before describing AI connectivity as working.
