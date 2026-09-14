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

## Distance/time records and trainer explanations (implemented 2026-09-12)

Records use an optional `measurementType` discriminator: legacy/`repetitions`, `distance_time`, `duration`, or `distance`. Extraction version `workout-v3-measurements` preserves explicit distances in meters and durations in seconds, one set object per interval. Cardio values keep kg=null/reps=0 and are excluded from weighted volume. Missing units remain review items. Both inline and full record editors support up to eight intervals. Calories, separate rest/resistance fields, pace charts and automatic cardio lesson prescriptions are not implemented; context such as rest/resistance remains in the notes.

The paper title and original filename share a centered single line. Long filenames truncate visually, while the original filename remains available in the file header and accessibility label.

“AI 도우미에 이 기록 질문” opens a source-linked draft question, including the unsaved input and trainer notes. It is sent only when the trainer submits it. The assistant explains units and asks about missing distance/time, equipment, rest or intent; it does not automatically change records.

A trainer explicitly opting into “내 계정의 다음 판독에도 참고” saves the source spelling, confirmed exercise/type and explanation in trainer-owned `interpretations` alongside source provenance and revision. Up to 40 saved rules are supplied as reference data to subsequent extraction and assistant requests. A conflicting existing rule requires an explicit edit in the assistant's saved-rule section. These rules can be edited/deleted there; ordinary chat does not create permanent rules. This is saved context, not Gemini model retraining. Original explicit units override defaults, and session-specific notes remain on the record unless the trainer chooses broader reuse. Analysis receives corrected measurement fields and correction reasons; comparisons require compatible equipment, distance, resistance and rest conditions.

Record synchronization compares map contents independent of Firestore key order. Row edits fence on row/record revisions rather than unrelated file changes; true concurrent edits still fail safely. A report enqueue failure is displayed in analysis state and no longer turns a committed correction into a false save failure.

Reference: Concept2 PM5 documentation describes fixed distance/time workouts and results/splits: https://www.concept2.com/support/monitors/pm5/how-to-use

For popup authentication the app returns `Cross-Origin-Opener-Policy: same-origin-allow-popups`. A Google/Firebase popup's own report-only diagnostics can still appear independently of whether login completes. Do not silence console errors or disable Auth/App Check to address a transport failure. Verify the actual callable URL and its preflight response before describing AI connectivity as working.


### 화면 캡처 질문 (2026-09-12)

AI 도우미와 원본 툴바의 캡처 버튼은 현재 앱의 보이는 화면 전체에서 드래그할 수 있는 오버레이를 연다. 원본 열기나 2뷰 전환 없이 현재 배치를 유지한다. 마우스를 놓으면 선택 영역만 JPEG로 잘라 바로 질문 입력창에 첨부하며, 입력 중인 질문은 유지한다. ESC 또는 닫기로 취소하고 첨부 이미지는 삭제할 수 있다. 키보드 사용자는 화면 전체 선택을 이용할 수 있다. 캡처 중 화면 크기가 바뀌면 좌표 오류를 막기 위해 취소한다.

캡처 범위는 현재 브라우저의 앱 화면이다. 다른 앱·브라우저 탭이나 OS 전체 화면을 촬영하지 않는다. 캡처는 브라우저 안에서 만들고 질문을 보낼 때만 AI에 전달한다. 서버에는 원본 파일/페이지를 허위로 연결하지 않고 screen 유형, 영역 좌표, 이미지 해시를 저장한다. 보낸 캡처 이미지는 회원별 chatAttachments에 따로 보관해 대화에서 다시 볼 수 있다. JPEG 500,000자 제한, 회원 권한, 사용량 제한과 재시도 중복 방지는 기존 질문과 동일하게 적용한다. AI는 화면의 미저장 입력과 분석 문구를 저장된 원본 사실로 단정하지 않는다.

빈 대화에서는 운동 기록에 맞춘 추천 질문 3개를 보여주고, 캡처 버튼과 둥근 입력창을 하단에 배치한다. 입력창 내부에는 캡처 아이콘과 보내기 버튼을 둔다.

캡처 첨부 카드(이미지와 이름)를 클릭하면 크게 보기 모달이 열린다. 배경, 닫기 버튼 또는 ESC로 닫으며 원래 첨부 카드로 키보드 포커스를 복원한다. AI 질문 입력은 Enter로 전송, Alt+Enter로 커서 위치에 줄바꿈한다. 한글 IME 조합 중의 Enter는 전송하지 않는다.

화면 캡처 질문의 fileId는 빈 문자열이다. 서비스 내부뿐 아니라 trainerAi 공통 진입 검증에서도 chat 요청에 한해 이를 허용해야 한다. 파일 기반 read/review 요청, 회원 권한, 인증 검사는 유지한다. callable.test.mjs에서 실제 callable handler의 진입 검증을 실행하여 이 경계의 회귀를 확인한다.


### 도우미 답변과 참고 자료 (2026-09-12)

긴 답변은 핵심 답변 다음에 짧은 소제목·문단·목록을 배치한다. HTML은 실행하지 않으며 강조, 목록, 소제목과 검증된 출처 표식만 표시한다. 기록의 관찰 사실과 훈련 의도에 대한 추정을 구분한다.

‘근거 N’은 ‘참고한 운동 기록’으로 바꾼다. 접힌 영역을 열면 날짜·운동명·페이지와 기록 수정으로 이동하는 버튼을 보여준다. 새 답변에는 참조 당시 기록 이름을 함께 저장하며, 삭제된 기록은 이동할 수 없다고 표시한다. 회원 기록은 기관 지침이나 논문의 출처가 아니다.

외부 출처는 서버가 제공한 HTTPS 링크가 있을 때만 ‘웹 출처’로 따로 표시한다. 외부 정보가 필요한 질문은 AI가 일반 검색어를 만들고, 서버의 개인정보 검사와 별도 AI 안전 검토를 통과하면 Google Search를 사용한다. 추가 검토·검색 호출에는 원래 질문·회원 기록·캡처를 전달하지 않는다. 검색 결과의 groundingSupports에 연결된 문장과 출처만 표시한다. Google 검색 추천은 스크립트 실행과 앱 접근을 막은 별도 iframe으로 표시한다. 서버 단계에 맞춰 생각 중/검색 내용 확인/웹 검색/답변 정리를 표시하고, 검색 실패·제한은 설명한다.

큰 캡처 안내는 빈 대화에서만 보인다. 이후에는 입력창의 캡처 아이콘을 이용한다. 답변 하단에는 복사와 다시 생성이 있다. 다시 생성은 같은 질문·캡처로 현재 답변을 교체하며 새 대화를 추가하지 않는다. 실패 시 기존 답변을 유지하고, 같은 요청의 중복 과금을 막는다. 지난 대화도 대화 기록에서 열면 후속 질문과 다시 생성을 제공한다.


### 자동 검색 제한과 비용

검색 범위는 운동·스포츠과학·건강 교육·영양·기구·코칭 자료다. 개인정보 추적, 불법·폭력·자해·성착취·혐오·사기·해킹·약물 오남용 실행과 제한 우회 요청은 거절한다. 민감 단어를 언급한 예방·위험 교육은 문맥을 구분해 허용한다. 다른 모델의 비공개 금칙어 목록을 복제하거나 완전 차단을 보장하지 않는다. Gemini의 중간 이상 유해성 차단을 함께 적용한다.

Google Search 비용은 검색 쿼리당 14,000 micro-USD로 기존 월간/전체 예산에 합산한다. 무료 제공분을 가정하지 않고 사전 예약하며, 응답의 고유 검색어 수로 정산한다. Google이 내부에서 검색어를 확장할 수 있어 요청 전 10개분을 보수적으로 예약한다. 검색어 수가 불명확하면 예약액을 비용 추정에 남긴다. 실제 내부 확장 개수의 하드 제한은 API에서 제공하지 않으므로 이 수치는 청구 상한 보장이 아니다. 질문 한 번에 외부 검색 API는 최대 한 번만 호출하며 반복 검색 루프는 없다. 계획/안전 검토/검색 각각 기존 호출 한도에 포함된다.


### 지난 대화 이어쓰기 (2026-09-12)

대화 기록에서 선택한 대화에 입력창을 표시하고 같은 generation에 새 질문을 저장한다. 현재 대화의 generation은 바꾸지 않는다. 서버는 명시적인 resumeConversation 요청과 해당 회원의 보관된 chatSessions 문서를 함께 확인하며, 오래 열린 현재 대화 화면이 묵시적으로 이전 대화에 전송하는 것은 계속 차단한다. 이전 답변 연결도 같은 대화 안에서만 허용한다.

메시지는 날짜 범위 대신 generation으로 조회한다. 대화 ID가 없던 초기 기록은 0번 대화의 원래 보관 시각까지 조회해 합친다. 기존 메시지와 캡처를 복제하거나 삭제하지 않는다. 최근 사용한 보관 대화는 기록 목록 상단으로 올라오며, 새 채팅의 빈 대화 판단은 현재 generation만 대상으로 한다.

화면에는 대화별 최근 질문·답변 최대 40개, 기록 목록 최대 30개를 보여준다. AI 요청에는 연결된 최근 질문·답변 최대 3쌍을 전달한다. 대화 간 이동 시 작성 중인 질문과 캡처는 해당 화면의 메모리에 별도로 유지하고 돌아왔을 때 복원한다. 이 미전송 초안은 새로고침 후까지 보관하지 않는다. 전송 중에는 대화 전환을 막아 응답이 다른 대화의 입력을 지우지 않게 한다.


### 판독 카드와 작업 탭 정리 (2026-09-12)

Kenko UI Kit의 workout details 프레임(https://www.figma.com/design/jAK0FSaOxPgHm0P4DlmRJV/kenko-ui-kit-update-1?node-id=0-2173)을 참고했다. 제목·보조 상태·운동 목록의 계층, 일정한 행 간격과 얇은 구분선을 적용하되 Trainer Note의 녹색 계열을 유지한다. 공통 작업 탭은 아이콘과 선택된 흰 배경으로 구분한다. 분석의 판단 기준과 AI 해석 내용은 이 화면 정리에서 변경하지 않는다.

판독 카드 바깥의 파일 제목을 없애고 카드 헤더에 순서·파일명·페이지·판독 상태·수정 필요 개수를 모은다. 연도 설정과 파일별 확인 항목은 첫 페이지 카드 안에서 한 번 제공한다. 기록 수정 옆 숫자는 미확정 운동과 별도 원문을 합산하며, 누르면 수정이 필요한 항목의 편집창을 열어 이동한다.

같은 운동 행을 다시 누르면 편집창을 접는다. 접는 동안 입력 폼을 유지하여 미저장 값과 표기 해석 체크 상태가 사라지지 않게 한다. 수정 반영 전에는 저장되지 않으며, 다른 기록으로 옮길 때의 미저장 확인은 유지한다. 저장 중에는 편집 전환을 막는다. 체크박스는 일반 입력창의 전체 너비 스타일에서 분리한다.

- 확인할 내용의 ×는 해당 알림만 닫는다. 원본·운동 기록·미확정 상태는 유지하며, 닫은 알림은 계정에 저장하여 카드/탭 개수와 수정 필요 이동 대상에서 제외한다. 알림 내용이 바뀌면 다시 표시한다. 편집 중인 입력과 저장 리비전은 알림 닫기의 영향을 받지 않는다.

- 기록 수정 레이아웃은 Kenko의 [Create Workout](https://www.figma.com/design/jAK0FSaOxPgHm0P4DlmRJV/kenko-ui-kit-update-1?node-id=0-1019), [Tracking](https://www.figma.com/design/jAK0FSaOxPgHm0P4DlmRJV/kenko-ui-kit-update-1?node-id=0-931), [Stats](https://www.figma.com/design/jAK0FSaOxPgHm0P4DlmRJV/kenko-ui-kit-update-1?node-id=0-553)를 참고한다. 파일 제목·상태, 날짜·세트 합계, 확인 알림, 운동 목록을 분리하고 기존 세이지 색상을 유지한다. 운동명과 부위 태그 옆에는 세트 번호·중량·횟수(또는 거리·시간)를 정렬한다. 650px 미만 패널에서는 세트 표를 운동명 아래로 배치한다. 수정 폼은 기본 정보, 세트 기록, 메모의 세 구획으로 나눈다.

- 기록 수정 상단의 점 3개는 진행 분석과 같은 메뉴를 사용하며 글자 크기는 화면별·회원별로 저장한다. 복사와 PDF는 입력창을 제외한 표시 중인 판독 기록을 내보낸다. 다시 생성은 선택한 원본(전체 선택 시 전체 원본)을 재판독하되, 저장된 모든 운동은 보존하고 새롭게 구분된 항목은 중복 검토 대상으로 둔다. 수정 중인 입력은 저장 또는 취소 후 다시 생성할 수 있다.


### 압축된 운동 목록과 수업 패널 이동 (2026-09-12)

기록 수정과 다음 수업은 중첩 카드 없이 흰 바탕과 얇은 운동 구분선으로 이어진다. 동일한 연속 세트는 `1–4세트 · 16kg × 12회`처럼 묶되 값이 다른 세트와 거리·시간 구간은 각각 표시한다. 펼친 수정창에서 실제 세트별 값을 편집하며, 메모·판독 참고는 접을 수 있다. 숫자를 읽기 쉽게 유지하고 여백과 반복 라벨을 줄여 밀도를 높인다.

Kenko Figma의 Onboarding 섹션 제목에서 확인한 Questrial Regular를 영문·숫자에 사용한다. 한글은 시스템 글꼴로 대체한다. Google Fonts 공식 저장소의 글꼴과 OFL 라이선스를 public/fonts에 함께 포함하여 외부 폰트 요청 없이 제공한다. Kenko 프로토타입의 실제 전환 설정은 확인하지 못했으므로 동일 애니메이션의 복제라고 표시하지 않는다.

3뷰의 우측은 AI 도우미와 다음 수업을 전환한다. 선택된 중앙 다음 수업 탭의 오른쪽 화살표와 우측 다음 수업 탭의 왼쪽 화살표가 동일한 포털 컨테이너를 옮긴다. 본문에는 이동 도구를 두지 않으며, 왼쪽 이동 시 우측은 AI 도우미로 복귀한다. 편집 상태는 이동 후에도 보존한다. AI 도우미도 탭 전환 시 마운트 상태를 유지한다. 이동은 280ms ease-out이며 동작 줄이기 설정에서는 생략한다. 2뷰 전환 시 우측 수업은 가운데로 돌아온다. 미저장 수업·질문 초안의 보존은 현재 화면에서만 제공하며 새로고침 보관을 의미하지 않는다.

운동 목록의 수정 안내와 편집창의 반복 제목·원본 페이지 문구를 생략한다. 운동명·날짜·운동 부위 입력은 동일한 38px 높이와 기준선을 사용한다. 운동 부위·기록 방식·중량 기준은 앱 색상의 선택 메뉴로 제공하며 키보드 이동/선택, Escape·바깥 클릭 닫기를 지원한다. 현재 선택을 재선택해도 세트 값을 초기화하지 않고, 메뉴 선택 이벤트는 원본 카드 클릭으로 전파하지 않는다.

- 진행 분석의 네 하위 탭과 점 3개 메뉴는 같은 줄에 둔다.
- 한발 운동은 횟수 구분에서 L/R을 선택하고 각 측면의 횟수를 입력한다. 세트의 leftReps/rightReps는 각각의 값, reps는 합계이며 좌우 한 쌍을 1세트로 센다. 일반 횟수와 전환하면 횟수를 다시 확인한다. 같은 값은 ‘좌우 각 N회’, 다른 값은 ‘L N회 / R N회’로 표시한다.
- LR 원문 판독은 명시된 측면만 보존한다. 한쪽 누락은 확인 대상으로 남긴다. 운동명만으로 기존 기록을 변환하지 않는다. 진행 비교는 좌우 중 낮은 횟수를 사용하며 일반 횟수와 좌우 합계의 기록을 섞어 비교하지 않는다.


### 기록에 연결된 목표 평가 (2026-09-14)

목표 평가의 고정 분야 목록을 없애고, 서버가 같은 기간의 실제 기록에서 만든 후보 중 AI가 목표에 관련된 근거를 최대 3개 선택한다. 화면은 추이 그래프·시작/최근 비교·설정 목표 막대·수행 조건 표의 네 형식으로 표시한다. 수치와 목표값은 기록/확정 설정에서 계산하며 AI가 임의 점수나 목표값을 생성하지 않는다. 근거 부족은 별도로 표시한다.

요약·분포·변화 추이·목표 평가는 같은 기간과 확인 필요/제외 기록 필터를 사용한다. 목표 적용일 이전 기록은 목표 판단에서 제외한다. 각 근거 카드에서 대응 탭과 운동/부위로 이동한다. 그래프 원본 이동은 기록 수정 화면을 열지 않는다.

목표·기록 리비전·평가 결과·수업 메모·기간이 바뀔 때 새 분석 키를 만든다. 작업실에서 자동 생성하되 같은 키는 Firebase와 화면 캐시를 재사용한다. 탭 이동만으로 AI를 재호출하지 않는다. 동시 생성은 서버 잠금으로 합치며 생성 중 데이터가 바뀌면 이전 응답을 표시하지 않는다. 트레이너 동의·수정·보류는 해당 분석 키에 저장하고 다음 생성의 참고로 제공한다.


### 분석에서 이어지는 다음 수업 (2026-09-14)

실제 작업실의 다음 수업은 connected-lesson 경로를 사용한다. 공통 기간·확인 필요 제외 기준·목표 적용일·수업 메모·평가 결과가 목표 평가와 동일하다. 같은 입력의 목표 평가와 트레이너 동의/수정/보류를 읽고, 실제 기록과 함께 구성 근거로 전달한다. 예전 analysis-and-plan의 program을 새 작업실의 초안으로 사용하지 않는다.

화면 진입은 저장된 제안 또는 기록 기반 초안 조회이며 모델 호출이 없다. ‘AI로 수업 제안’은 현재 근거와 저장 계획 리비전당 생성 결과를 재사용한다. AI는 운동/평가 후보·목표 연결·유지/조정 검토/평가·조정 방향을 선택한다. 수치 초기값은 해당 운동의 최근 기록을 복사한다. 트레이너가 오늘 조건을 확인해 수치를 편집하고 확정 저장한다. 구간 수를 완료 라운드로 추정하지 않으며 새로운 정량 처방은 이 경로에서 생성하지 않는다.

근력은 중량·횟수/LR·세트, 유산소는 경사%·속도km/h·시간초 또는 거리m 등 원래 측정 유형을 유지한다. 확정한 평가 프로토콜은 별도 평가 항목으로 포함할 수 있다. 운동마다 구성 근거와 관련 분석/원본 링크를 둔다.

기존 plans/current는 자동으로 덮어쓰지 않는다. 새 제안은 기존 구성/수치와 비교한 뒤 작업 초안에 적용한다. 기록·목표·판단이 바뀌면 새 근거 알림을 표시하며 저장 시 근거와 계획 리비전을 확인한다. 편집 중 내용은 탭 이동 시 유지된다. 새로운 lesson 필드와 하위 호환 program을 함께 저장한다. AI 한도/생성 오류에도 기록 기반 초안과 저장 계획은 사용 가능하다.

### 다섯 작업 화면의 공통 디자인 (2026-09-14)

원본보기·기록수정·진행분석·다음수업·AI 도우미의 공통 시각 기준은 `src/app/workspace-design.css`에서 관리한다. 이 파일은 기능별 CSS 다음에 불러온다. 기능별 스타일에서는 표·그래프·뷰어·대화의 구조를 관리하고, 같은 역할의 글자·컨트롤·여백을 별도 값으로 재정의하지 않는다.

- 글꼴: Questrial + 시스템 한글 글꼴. 제목 16px, 소제목·운동명 14px, 본문·입력 13px, 컨트롤 12px, 보조 정보 11px. 그래프 수치·KPI의 강조 크기는 유지한다.
- 작업 탭: 54px 상단 바, 36px 탭 컨트롤, 동일한 아이콘과 연한 세이지 선택 배경. 원본 도구·기록 선택·분석 하위 탭·다음 수업 제목·대화 관리는 48px 보조 바의 같은 기준선에 둔다.
- 일반 컨트롤·입력창 8px, 팝업 12px 모서리. 동일한 테두리·초점 표시·메뉴 그림자. 다음 수업 점 세 개 아래에는 독립된 구분선을 두지 않는다.
- 본문 가로 여백 22px, 좁은 패널 14px. 다음 수업 제목·AI 제안·설정은 한 줄을 유지한다. 세트 표는 충분한 폭에서 운동명 오른쪽, 좁은 폭에서는 아래에 표시한다.
- 기록 선택과 요약 그래프의 수업일 선택도 기존 `WorkoutSelect`를 사용한다. 키보드 이동·Enter 선택·Escape 닫기 동작을 공통으로 사용한다.
- 글자 크기는 `tn-workspace-text:<memberId>`의 단일 설정이다. 기존 화면별로 서로 달랐던 배율은 새 공통 설정에 가져오지 않고 100%에서 시작한다. 기록·분석·다음 수업·도우미 본문에 함께 반영되며 탭/툴바는 고정 크기를 유지한다. 원본 이미지 확대는 문서 판독 기능이므로 기존 뷰어에서 따로 조절한다.

실제 회원 작업실의 2뷰·3뷰, 우측으로 수업 이동, 공통 메뉴, 기록·날짜 선택, 입력창, 125% 배율 동기화와 100% 복원을 확인했다. 회원 기록·수업 계획은 저장하지 않았다. 타입 검사 통과. 기존 분석 오류 배너의 생성 원인은 이번 시각 기준 변경 범위에 포함하지 않는다.

### 다음 수업 출처·생성 상태·인터벌 표시 (2026-09-14)

- 최초 프로그램은 저장한 계획 우선, 없으면 현재 근거에 캐시된 AI 제안 또는 선택 기간의 최근 수업 기반 초안이다. 화면에 저장한 수업 계획 / AI 제안 / 최근 수업 기반 초안과 날짜를 짧게 표시한다.
- AI 제안의 구성 근거는 운동 목록 위에 펼쳐 보여준다. 실제 참고 날짜의 원본 링크와 목표 평가 링크를 함께 둔다. 제안 미리보기와 적용 후 화면 모두 같은 컴포넌트를 사용한다.
- 제안 요청 중에는 해당 수업 패널 본문 전체를 로딩 화면으로 전환한다. 문구는 ‘다음 수업을 구성하고 있어요’와 ‘기존 프로그램·수행 기록·목표를 함께 확인 중’. 임의 진행률 없이 완료 시 새 제안 미리보기로 이동한다. 오류·장시간 지연 시 원래 계획과 재시도 경로를 보여주며, 로딩과 계획 저장 상태를 구분한다.
- 인터벌 표시는 판독/저장 데이터를 수정하지 않는다. 유효한 유산소 기록에서 전체 구간이 정확히 반복되는 경우에만 한 주기의 구간과 반복 횟수를 표시한다. 예: 두 구간이 세 번 반복되면 ‘2구간 × 3회 반복 · 전체 6구간’. 이는 기록된 구간 패턴이며 완료 라운드나 추가 수행을 추정하지 않는다. 한 구간이라도 값이 다르거나 누락된 경우 기존 구간별 표시를 유지한다.
- 기록 수정과 다음 수업은 같은 반복 표시 컴포넌트를 사용한다. 실제 편집창과 저장/분석에는 모든 원래 구간이 유지된다. 별도 반복 라운드 설정도 이 표시를 통해 변경하지 않는다.
