# 트레이너 노트

기준 개발 폴더: `/Users/joord/Desktop/Joord/trainer-note`

## 실행

이 폴더에서 `npm run dev` 후 http://localhost:3001 을 엽니다.
검증: `npm run build`, `npm run typecheck`.

## 현재 구현

- Firebase Google 로그인, 로그인 상태 유지, 계정 표시 및 로그아웃
- 실제 회원 등록·수정·삭제, 목표·메모 저장, 검색, 계정별 Firestore 실시간 목록
- 예시 둘러보기: 파일 미리보기 및 2뷰·3뷰 작업 화면
- Kenko 전신 그래픽: 앞·뒤 전환, 부위별 비율, 이두·삼두 구분, 클릭·호버 강조
- 세트·볼륨 선 그래프와 원본 기록 연결
- 종합 의견 및 다음 수업 프로그램 초안 UI
- 화면 폭에 따른 배치, 탭 전환 시 스크롤 초기화

기본 화면은 로그인한 트레이너의 실제 회원 목록입니다. 회원 이름·목표·메모는 Firestore에 저장됩니다.
기존 회원 A의 분석 및 파일 미리보기는 별도의 **예시 둘러보기** 화면입니다. 예시 화면의 파일과 선택값은 새로고침하면 초기화됩니다.
회원별 PDF·PNG·JPEG 저장 코드와 실제 Storage 버킷 연결이 완료됐습니다. 로컬 3001 환경에서 업로드 기능을 활성화했습니다. 직접 확정한 운동 기록의 저장·집계가 연결됐습니다. Gemini 3.1 Flash-Lite 자동 판독과 원본 대조·확정 저장을 연결했습니다. 서버 자동 판독·AI 종합 분석·수업 계획 코드는 추가했으며, 아래 서버 모드 절차의 클라우드 승인·배포 전까지 기존 판독 흐름을 유지합니다.

2026-09-11: Documents/ChatGPT/Trainer-Note에서 작업했던 최신 UI를 이 폴더에 반영했습니다.
이후 앱 개발은 이 폴더를 기준으로 진행합니다.

## Firebase Authentication

- Firebase 프로젝트: `trainer-note-a9dd7`
- 웹 앱: `trainer-note-web`
- 관리 계정: `trainer.note.app@gmail.com` (서비스 로그인은 각 트레이너의 Google 계정 사용)
- 설정: Firebase 웹 앱의 공개 설정 6개(`NEXT_PUBLIC_FIREBASE_API_KEY`, `AUTH_DOMAIN`, `PROJECT_ID`, `APP_ID`, `MESSAGING_SENDER_ID`, `STORAGE_BUCKET`; 각 항목 모두 `NEXT_PUBLIC_FIREBASE_` 접두사 사용)를 `.env.local`에 작성 후 개발 서버를 실행합니다.
- Firebase Auth: Google 로그인 활성화, `localhost` 허용 도메인 확인 완료.
- Auth 설정 배포: `npx -y firebase-tools@latest deploy --only auth --project trainer-note-a9dd7`
- `firebase.json`의 도메인 선언 외에 Firebase Console의 실제 Authorized domains도 확인해야 합니다. 운영 주소는 도메인만 추가합니다.
- 로그인 전에는 작업 화면을 렌더링하지 않습니다. 계정 UID 변경/로그아웃 시 작업 화면을 해제하여 임시 파일 URL과 입력 상태를 지웁니다.
- 로그인은 브라우저 local persistence를 사용합니다. 공용 기기에서는 사용 후 로그아웃합니다.

현재 AuthGate는 클라이언트 화면 전환을 담당합니다. 서버 API 인증이나 데이터 접근 권한을 대신하지 않습니다.
Firestore 회원 정보에는 UID별 경로 및 Security Rules를 적용했습니다. Storage에도 소유자 규칙을 배포하고 Firestore 조회용 서비스 권한을 적용했습니다. 서버 API에서는 ID 토큰을 검증해야 합니다.
Admin SDK 비밀 키는 브라우저나 NEXT_PUBLIC 환경변수에 넣지 않습니다.

### 실제 계정 확인

`http://localhost:3001`에서 Google로 계속하기 → 본인 계정 선택 → 사이드바 계정 표시를 확인합니다.
새로고침 시 로그인 유지 → 로그아웃 시 로그인 화면 복귀 → 다른 계정 로그인 시 임시 작업 초기화를 확인합니다.
브라우저에서 직접 Google 인증을 마치는 과정은 사용자 확인이 필요합니다.

2026-09-11 검증: production build 및 TypeScript 통과. 별도 브라우저에서
비로그인 화면 제한, Google OAuth 계정 화면 도착, 팝업 취소 시 한글 오류 및 재시도,
새로고침 후 비로그인 유지, 375px 모바일 레이아웃을 확인했습니다.
실제 Google 계정 로그인 완료·로그인 유지·로그아웃은 아직 사용자가 확인하기 전입니다.

## 실제 회원 관리 (2026-09-11)

경로: `trainers/{로그인 UID}/members/{자동 생성 회원 ID}`.
회원 필드: 이름(1~60자), 목표(0~300자), 메모(0~1000자), 서버 생성/수정 시각.
동명이인은 문서 ID로 구분합니다. 조회는 생성 시각 내림차순 실시간 구독입니다.
서버 확인 전에는 저장 완료로 표시하지 않으며, 오프라인과 조회/저장 오류를 구분합니다.
회원 삭제는 확인 대화상자를 거칩니다. 연결된 PDF가 있으면 먼저 PDF를 삭제해야 회원을 삭제할 수 있습니다.

Firestore `(default)` / Standard / 기존 `nam5` 위치를 사용합니다.
`firestore.rules`는 소유자 UID 확인, 필드 검증, 생성 시각 불변, 서버 수정 시각을 요구하고 나머지 경로는 차단합니다.
규칙 배포는 `npx -y firebase-tools@latest deploy --only firestore:rules --project trainer-note-a9dd7`입니다.

검증: `npm run build -- --webpack` 및 규칙 테스트 20개 통과.
규칙 테스트는 Java 21 이상과 Firebase CLI가 필요합니다. `npm run test:rules`는 실제 프로젝트 대신 `demo-trainer-note` 에뮬레이터에서만 실행합니다.
별도 브라우저 테스트는 Google 인증 부분만 테스트 UID로 대체한 뒤 **실제 MemberWorkspace·Web SDK·Firestore 에뮬레이터·보안 규칙**을 사용했습니다.
등록, 수정, 새로고침 후 보존, 검색, 두 트레이너 목록 분리, 오프라인 버튼 상태, 확인 후 삭제, 모바일 가로 넘침을 확인했습니다.
운영 Google 계정과 실제 Firestore를 연결한 최종 동작은 `localhost:3001`에서 회원 등록 후 새로고침하여 확인할 수 있습니다.

다음 구현 순서: 확정 기록으로 집계 확장 → 근거를 포함한 분석과 수업 준비.

## 회원별 PDF·이미지 원본 저장 (2026-09-11)

구현: 회원 선택 후 PDF·PNG·JPG·JPEG 최대 10개 업로드(파일당 50MB), 진행률·중단, 실시간 파일 목록,
새로고침 후 유지, 인증된 PDF 미리보기·내려받기·삭제. 내용의 SHA-256으로 같은 회원의 동일 PDF 중복을 막습니다.
브라우저는 허용 확장자·크기·PDF/PNG/JPEG 형식 시그니처를 검사합니다. 원본 저장은 판독 완료를 뜻하지 않습니다.

- Firestore: `trainers/{uid}/members/{memberId}/files/{sha256}`에 파일명·크기·상태·서버 시각.
- Storage: 동일 경로 아래 PDF는 `source.pdf`, PNG는 `source.png`, JPG/JPEG는 `source.jpg`. 다른 계정 및 비로그인 접근을 거부합니다.
- 업로드 전 연결 정보를 예약하고 회원 `fileCount`와 원자적으로 갱신합니다. 기존 회원은 0개로 처리합니다.
- 업로드 중단 후에는 ‘저장 확인’으로 완료된 원본을 확인하거나 항목을 삭제 후 다시 올립니다.
- 삭제는 상태 변경 → 원본 삭제 → 연결 정보·카운터 갱신 순서입니다. 중단되면 목록에서 삭제를 재시도합니다.
- 브라우저 미리보기는 인증된 `getBlob`과 임시 URL을 사용하고 닫기/회원 전환/로그아웃 시 URL을 해제합니다.

검증: 빌드 및 규칙 테스트 **34개** 통과. 실제 컴포넌트·SDK와 Firestore/Storage 에뮬레이터를 사용한
브라우저 검사에서 PDF 업로드, 새로고침, Blob 미리보기, 중복·잘못된 PDF 차단, 계정별 분리,
삭제 후 회원 삭제 가능 상태, 모바일 가로 넘침 없음, JavaScript 오류 없음을 확인했습니다.
테스트에는 실제 Google 계정 대신 에뮬레이터 UID를 사용했습니다. 실제 버킷의 규칙·서비스 권한·CORS·비로그인 접근 차단도 확인했습니다. 실제 Google 계정으로 업로드·미리보기·삭제를 마치는 확인은 남아 있습니다.

### 운영 활성화 조건

2026-09-11: 결제 계정 활성화 및 기본 버킷 생성 확인 완료.
- 버킷: `trainer-note-a9dd7.firebasestorage.app` (사용자가 생성한 `US-CENTRAL1`).
- Storage 보안 규칙 배포 후 실제 규칙 내용 재조회 확인.
- Storage 서비스 계정에 `roles/firebaserules.firestoreServiceAgent`를 적용해 원본 연결 문서 조회 허용.
- `storage.cors.json`의 개발 주소를 버킷에 적용. 공개 IAM 접근 권한 없음 확인.
- 로컬 `.env.local`의 버킷 이름을 대조하고 `NEXT_PUBLIC_STORAGE_ENABLED=true`로 활성화.
- 클라우드 비로그인 파일 목록 요청 403 및 브라우저 사전 요청 응답 확인.

`NEXT_PUBLIC_STORAGE_ENABLED`는 UI 활성화 값이며 보안 장치가 아닙니다. 권한은 서버 규칙으로 검사합니다.
다른 실행/배포 환경에서는 다음 설정을 적용해야 합니다.

1. 프로젝트 소유자가 결제 인증을 완료한 뒤 프로젝트 billingEnabled와 결제 계정 open 상태를 확인하고 Storage 버킷 생성(위치 확인).
2. `.env.local`의 `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`을 실제 생성된 버킷 이름과 대조.
3. `npx -y firebase-tools@latest deploy --only firestore:rules,storage --project trainer-note-a9dd7` 실행.
   Storage 규칙이 Firestore 문서를 읽는 데 필요한 교차 서비스 권한 설정도 확인합니다.
4. `storage.cors.json`을 실제 버킷 CORS에 적용합니다. 현재 3001 개발 주소 두 개만 포함되어 있습니다.
   예: `gcloud storage buckets update gs://실제버킷이름 --cors-file=storage.cors.json`.
   공개 서비스 주소가 생기면 해당 origin도 추가해야 인증된 `getBlob` 미리보기가 동작합니다.
5. 로컬 `.env.local`에 `NEXT_PUBLIC_STORAGE_ENABLED=true`를 추가하고 재시작합니다.
   실제 계정으로 업로드·미리보기·다른 계정 차단을 확인한 뒤 운영 배포 환경에서도 활성화합니다.

Blaze 관련 공식 안내: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
Blob/CORS 안내: https://firebase.google.com/docs/storage/web/download-files

## 직접 확인한 운동 기록 (2026-09-11)

`localhost:3001` → 로그인 → 회원 선택 → **기록 입력**.
PDF·PNG·JPEG를 로컬에서 열어 왼쪽 원본/오른쪽 입력 폼으로 대조하거나 원본 없이 입력할 수 있습니다.
원본 PDF는 서버에 업로드하지 않습니다. 브라우저 PDF 뷰어를 사용하며 표시되지 않으면 ‘원본을 새 탭에서 열기’를 이용합니다.

한 기록은 한 날짜의 운동 한 종목입니다. 날짜(연도 필수), 원문 약어, 확인한 운동명, 주 부위,
중량 기준(외부 중량/맨몸/중량 미상), 최대 8세트의 무게·횟수, 메모를 입력합니다.
확인 체크 후 Firestore에 저장하며 이후 수정·삭제할 수 있습니다. 날짜는 UTC 정오로 저장하여 표시 시 날짜 이동을 피합니다.
AI 판독 결과로 표시하지 않고 `origin: manual`, `status: confirmed`로 저장합니다.

경로: `trainers/{uid}/members/{memberId}/records/{자동 ID}`.
생성·삭제 시 회원 recordCount를 같은 트랜잭션에서 갱신합니다. 기존 회원은 0개로 처리합니다.
기록이 남은 회원은 삭제할 수 없습니다. revision 비교로 다른 창에서 변경된 기록의 덮어쓰기를 막습니다.
원본이 있으면 파일명·SHA-256·페이지를 보존하며, 수정 화면에서 다시 여는 PDF의 해시가 일치해야 합니다.
PDF 없이 만든 기록에 사후 원본 연결은 아직 지원하지 않습니다.

집계는 서버에서 확인된 실제 기록만 사용합니다. 운동 날짜 수, 총세트, 외부 중량 × 횟수의 볼륨,
선택한 주 부위별 세트 비중을 계산합니다. 맨몸/중량 미상은 세트에 포함하고 kg·회 볼륨에서는 제외합니다.
다른 운동/기구 사이 강도 비교, 목표 달성 예측, AI 처방으로 해석하지 않습니다.

브라우저 검증: 실제 컴포넌트와 SDK + Firebase 에뮬레이터에서 PDF 선택, 확인 전 저장 차단,
저장·새로고침·수정, 1,080 → 1,200 kg·회 재계산, 맨몸 제외, 계정별 분리, 삭제, 작성 취소 보호,
모바일 가로 넘침 없음 및 JavaScript 오류 없음을 확인했습니다. 실제 운영 Google 계정 저장은 사용자 로그인 후 확인 대상입니다.

이전 Storage 보류는 해제됐으며 실제 버킷을 연결했습니다.
AI 자동 판독과 App Check 연결은 아래 구현 내용을 참고하세요.

### 이미지 업로드 지원 (2026-09-11)

운동일지 **파일 추가**에서 PDF·PNG·JPG·JPEG를 함께 선택하거나 끌어올 수 있습니다.
파일당 50MB, 한 번에 10개 제한은 동일합니다. 파일 목록에는 형식이 표시되고 이미지에는 이미지 미리보기를 제공합니다.
업로드 진행·중단·저장 확인·삭제 흐름은 PDF와 같습니다. 같은 JPEG를 .jpg/.jpeg로 다시 올려도 내용 해시로 중복을 검사합니다.
기존 source.pdf 경로를 변경하지 않아 저장된 PDF를 계속 열 수 있습니다.

Firestore는 세 가지 MIME만 허용하며, Storage는 예약 문서 MIME·요청 MIME·고정 파일 경로를 대조합니다.
형식 시그니처 검사는 전체 이미지 디코딩이나 악성 파일 검사를 대신하지 않습니다. AI 처리 단계에서는 별도 파싱이 필요합니다.
규칙/형식 테스트 총 86개 통과. 브라우저에서 PDF 회귀, PNG·JPEG 업로드·재조회·디코딩된 미리보기·삭제,
JPG/JPEG 중복 방지, 로컬 기록 대조 이미지, 계정 분리와 모바일 레이아웃을 확인했습니다.


## Gemini 3.1 Flash-Lite 판독 (2026-09-11)

회원 → 운동일지의 **AI로 읽기** → 회원 연결 확인 / 필요하면 기록 연도 입력 → **판독 시작** → **원본 대조·확인** → **확정하고 저장**.

- 모델은 사용자 지정 `gemini-3.1-flash-lite`. Firebase AI Logic / Gemini Developer API를 사용하며 Gemini 비밀 키를 브라우저에 넣지 않습니다.
- PDF·PNG·JPEG를 인증된 Storage `getBlob`으로 읽고 AI에 전송합니다. 원본 업로드 50MB 제한과 별도로 판독은 **10MB 이하, 한 번에 한 파일**입니다.
- 날짜·운동명·주 부위·중량·횟수를 JSON으로 추출하고 응답을 별도 검증합니다. 연도가 없으면 지정 연도를 적용하거나 비워두며, 불명확한 숫자를 0kg·임의 횟수로 확정하지 않습니다.
- 회원 이름 불일치, 약어 해석, 누락 날짜/수치를 확인 항목으로 표시합니다. 시간·거리·라운드는 반복 횟수로 바꾸지 않고 별도 원문 목록에 남깁니다.
- AI 초안은 메모리에만 유지됩니다. 화면 종료/새로고침 시 미확정 초안은 사라지며 확인 안내를 표시합니다. 확정한 종목만 `origin: ai-reviewed`, `status: confirmed`로 Firestore에 저장됩니다. 직접 입력은 `manual`입니다.
- 원본 해시·페이지·원문 운동 표기·동일 표기 등장 순서로 만든 식별자를 사용합니다. 같은 식별자로 재저장/덮어쓰지 않습니다. 재판독 시 표기가 달라지는 경우 완전한 중복 검출은 보장하지 않으므로 기존 날짜/운동을 비교하도록 안내합니다.
- 원본 해시·파일명과 origin은 수정해도 유지합니다. 최대 60종목 / 종목당 8세트 응답 검증, 120초 제한, 중단, 계정 변경 시 결과 폐기, 429 크레딧/사용량 오류 안내가 있습니다.
- 구조화 응답은 SDK `responseSchema`를 사용합니다. 큰 중첩 `maxItems`는 실제 모델에서 HTTP 400을 유발하므로 전송 스키마에서 제외하고 클라이언트 파서가 개수 제한을 강제합니다. 제한을 넘는 응답은 저장되지 않습니다.

### AI 연결 설정

`.env.local` 또는 배포 환경에 아래 이름의 설정을 넣습니다. 값은 저장소에 커밋하지 않습니다.

```dotenv
NEXT_PUBLIC_AI_ENABLED=true
NEXT_PUBLIC_FIREBASE_AI_MODEL=gemini-3.1-flash-lite
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=your-public-recaptcha-enterprise-site-key
# 로컬 개발에만 사용. 등록된 토큰은 비밀로 보관하고 공유하지 않습니다.
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=your-local-development-debug-token
```

Firebase CLI `init ailogic`으로 기존 `trainer-note-web`에 AI Logic을 활성화했습니다.
프로젝트 소유자가 Generative Language 약관에 동의하고 `trainer-note-a9dd7`의 Gemini 결제/선불 크레딧을 활성화했습니다. Firebase 결제 연결만으로 Gemini 크레딧 충전이 완료되지는 않습니다.

App Check는 reCAPTCHA Enterprise를 사용하며 AI 서비스(`firebaseml.googleapis.com` App Check 서비스 ID)에 **ENFORCED**입니다.
로컬 localhost/127.0.0.1의 개발 빌드만 등록한 debug token을 사용합니다. production 번들에는 이 토큰이 포함되지 않는 것을 검사했습니다.
운영용 reCAPTCHA 허용 도메인은 현재 `trainer-note-a9dd7.firebaseapp.com`, `trainer-note-a9dd7.web.app`이며 localhost는 포함하지 않습니다. 새 운영 도메인은 키의 허용 도메인에도 추가해야 합니다.
App Check는 앱 인증이지 로그인 사용자별 과금 한도를 대신하지 않습니다. 현재 사용자별 사용량/상품 과금 시스템은 미구현입니다.

규칙·형식·파서 검사 총 104개(기존/규칙 87개 + 판독 파서 17개)와 production 빌드를 통과했습니다. 실제 컴포넌트/SDK + Firestore/Storage 에뮬레이터 브라우저 테스트도 수행했습니다.
브라우저 테스트에서는 AI 응답만 제어하여 누락 값 수정, 확인 전 집계 제외, 1,080kg·회 저장·새로고침,
중복 식별자, 결제 오류/잘못된 응답/중단 시 미저장, 다른 트레이너 분리와 모바일 가로 넘침 없음을 확인했습니다.
실제 Gemini 3.1 Flash-Lite 호출은 개인정보 없는 PNG·JPEG·PDF 테스트 일지로 각각 정상 응답(STOP)을 확인했습니다. 40kg×12회/60kg×10회를 추출하고 누락 연도를 비워두며 시간·거리를 별도 항목으로 분리했습니다. 이 테스트는 실제 손글씨 판독 정확도를 보증하지 않습니다.
App Check 없는 실제 AI 요청은 HTTP 401로 차단됩니다.


## 저장된 판독 · 자동 분석 · 무료 베타 서버 모드 (배포 대기)

**현재 상태:** 로컬 코드·에뮬레이터 검증 완료. 클라우드 API 활성화, 서버 전용 Gemini 키/Secret Manager 생성은 자동 승인 심사에서 거부되어 실행하지 않았습니다. 3001은 원본·진행 분석·수업 준비 화면으로 통일했습니다. `NEXT_PUBLIC_SERVER_AI_ENABLED` 미설정 상태에서는 원본 열람과 연결 대기 안내를 표시하며 서버 AI 호출은 실행하지 않습니다. 아래 기능과 사용 한도는 서버 배포·설정 전에는 라이브에 적용되지 않습니다.

### 동작

- 새 파일 manifest가 ready로 바뀌면 서버가 PDF/PNG/JPEG 원본을 읽습니다. 10MB 이하, 해시·MIME·크기를 검증하고 기존 추출 프롬프트에 원본 자체 대조 지시를 추가했습니다.
- 원본 판독 JSON, 행별 검증 결과, 토큰 사용량을 회원의 `imports/{fileHash}`에 저장합니다. 동일 파일 재열람/새로고침은 추출을 재호출하지 않습니다. 기존 업로드 파일은 ‘처음 판독하기’에서 시작합니다.
- 명확한 값은 `origin: ai-auto`, `status: provisional`로 자동 반영합니다. 규칙 검증 통과는 판독 정확도 보증이 아닙니다. UI에는 잠정 기록으로 표시합니다. 애매한 날짜·회원·숫자·단위·운동명 및 과거 동일 종목 대비 큰 중량 차이는 needs-review로 제외합니다.
- 빠진 연도/회원 확인은 파일 단위 일괄 보완이며 Gemini를 다시 읽지 않습니다. 분석 대상이 달라지면 종합 분석만 갱신될 수 있습니다. 트레이너가 이미 확정한 행은 일괄 보완으로 덮어쓰지 않습니다.
- 근거를 포함한 종합 의견과 다음 수업 프로그램은 **한 번의 AI 응답**으로 생성합니다. 최근 120개 운동 항목 + 목표·메모 + 최근 수정 이유를 사용합니다. 통계는 코드로 계산하고 원본을 다시 전송하지 않습니다.
- 보고서 캐시 키는 모델/프롬프트 버전, 기록·목표·메모, 판독 검토 상태를 포함합니다. 바뀌지 않은 입력은 캐시 재사용. 작업 중 변경되면 오래된 결과는 현재 보고서로 게시하지 않습니다.
- 부위별 인체 그래픽과 선 그래프는 실제 저장 기록을 사용합니다. 프로그램 근거 ID는 실재 여부를 검증합니다. 다른 기구/종목의 볼륨을 발전이나 강도로 단정하지 않도록 프롬프트에 제약했습니다.
- `plans/current`의 트레이너 수정 계획은 AI 보고서와 별도 보존합니다. 낙관적 revision 검사로 오래된 화면 덮어쓰기를 막습니다. 자동 재분석은 트레이너 계획을 덮어쓰지 않습니다.
- 예외 수정 이력은 `corrections`에 저장하여 이후 분석의 문맥으로만 사용합니다. 모델 자체 학습/파인튜닝이나 검증된 예측 모델은 아닙니다. 회원 간 데이터 학습·공유는 하지 않습니다.

### 원가와 한도

무료 베타, 추후 월 9,900원 구독을 검토합니다. 결제 시스템이나 유료 상품 제한은 아직 구현하지 않았습니다.

`functions/domain.mjs`의 기본 한도: 트레이너별 월 예상 모델 원가 **US$1**, 하루 요청 **30회**, 프로젝트 전체 월 예상 모델 원가 **US$20**. KST 일/월 경계입니다. API 호출 전 Firestore 트랜잭션으로 입력/출력 최대량의 비용을 예약하여 동시 요청 우회를 막습니다. 실패도 요청 수에 포함합니다. 응답 토큰이 확인되면 실제 metadata로 정산하고, 응답을 못 받으면 최대 예약액으로 보수적으로 기록합니다.

Gemini 3.1 Flash-Lite 공식 텍스트/이미지/PDF 요금 기준(2026-09-11 확인): 입력 $0.25/100만 토큰, 출력·thinking $1.50/100만 토큰. `usageMetadata`의 입력·총량/출력·thinking을 기록합니다. 예: 입력 10,000 + 출력 2,000 토큰 = **$0.0055**. 이는 요금표 기반 모델 비용 추정이며 세금/환율/Firestore/Storage/Functions/Cloud Tasks/네트워크 비용은 별도입니다. 월 US$1은 전체 Firebase 청구서의 하드캡이 아닙니다.

공식 가격: https://ai.google.dev/gemini-api/docs/pricing?hl=en

`aiUsage/{YYYY-MM}`, `aiDaily/{YYYY-MM-DD}`, `aiCalls/{id}`는 해당 트레이너만 읽고 서버만 기록합니다. 다른 사용자의 사용량이나 글로벌 예산은 브라우저에서 접근할 수 없습니다. `countTokens` 사전 확인 및 입력 32,768 / 추출 출력 12,288 / 분석 출력 4,096 토큰 제한을 사용합니다. 타임아웃 등 강제 종료로 예약만 남은 경우 자동 해제하지 않습니다(과소 집계를 방지). 운영자가 호출 로그/청구를 확인한 후 정산해야 합니다.

### 승인 후 적용할 구체적 범위

대상은 기존 **trainer-note-a9dd7** 프로젝트 하나입니다. 다른 프로젝트/결제 계정은 만들지 않습니다.

1. 서버 실행에 필요한 Cloud Functions, Cloud Build, Artifact Registry, Cloud Run, Eventarc, Cloud Tasks 및 API Keys, Secret Manager API를 활성화합니다. 이미 켜진 API는 유지합니다.
2. Generative Language API에만 제한된 서버 키 하나를 생성하고 Secret Manager의 `TRAINER_NOTE_GEMINI_API_KEY`에 저장합니다. 키 값은 브라우저·Git에 넣지 않습니다. 배포 서비스 계정에 필요한 비밀 조회/스토리지 원본 조회/Firestore/작업 큐 실행 권한만 부여합니다.
3. `trainer-ai` codebase의 callable `trainerAi`, 파일/기록/회원 트리거와 단일 동시 실행 `buildMemberReport` 작업 큐를 배포합니다. 최소 인스턴스는 0이며 Functions/빌드/작업 큐는 사용량에 따른 비용이 생길 수 있습니다.
4. 서버 소유 컬렉션과 잠정 기록 확인을 지원하는 Firestore 규칙을 배포합니다. 클라이언트의 자동 확정 위조·원가 리셋은 차단합니다.
5. 실제 ID token + App Check 호출, 원본 판독/저장/캐시 재조회, 서버 토큰 집계를 소규모로 검증합니다. 그 다음 `.env.local` 및 배포 설정에 `NEXT_PUBLIC_SERVER_AI_ENABLED=true`를 설정하고 3001을 재시작합니다.
6. 서버 경로 검증 후 기존 브라우저 AI Logic 직접 호출 경로를 차단합니다(API 비활성화 또는 허용 키 제한). 이 단계가 빠지면 구 클라이언트가 서버 한도를 우회할 수 있으므로 무료 베타를 외부에 공개하지 않습니다. Auth/Firestore/Storage 사용에 필요한 API 허용은 유지합니다.

위 변경은 아직 실행하지 않았습니다. 배포는 승인 후 `node scripts/build-functions.mjs`, `firebase deploy --only functions:trainer-ai,firestore:rules --project trainer-note-a9dd7` 범위로 진행하며 CLI의 추가 IAM 요구를 확인합니다.

### 검증

`npm install --prefix functions` 후 `npm run test:all` (Java 21+, 로컬 Firebase 에뮬레이터 필요).
서비스 테스트는 `FIRESTORE_EMULATOR_HOST`가 없으면 즉시 중단하며 라이브 DB에 접근하지 않습니다. Gemini와 큐 adapter는 제어된 테스트 대역을 사용합니다.

143개 테스트 통과: 중복/동시 판독, 캐시, 누락 연도·회원 일괄 보완, 트레이너 수정 충돌, 잠정 데이터 제외/재집계, 예산 동시 예약/실패 정산, 분석 변경 감지, 수업 계획 보존, 소유자 읽기·서버 전용 쓰기 및 기존 업로드/수동 기록 회귀.
별도 브라우저에서 실제 컴포넌트·Firestore/Storage SDK와 에뮬레이터를 연결해 자동 반영, 연도 보완 후 통계, 재열람/새로고침 시 AI 재호출 없음, 탭 전환 시 수업 입력 보존, 새 분석 후 저장된 계획 유지, 인체 그래픽/선 그래프, 모바일 가로 넘침 없음 및 런타임 오류 없음을 확인했습니다.

실제 Cloud Functions 배포·IAM·Gemini 직접 API 경로는 승인 후 통합 검증 대상입니다. 테스트 성공을 손글씨 판독 정확도나 목표 달성 예측 정확도로 해석하지 않습니다.


### UX 정정: 업로드 후 분석 화면이 기본 (2026-09-11)

사용자가 원한 기본 동선은 **업로드 → 자동 판독 → 진행 분석을 먼저 표시**입니다. 기록 입력/확정 목록을 통과하는 단계는 두지 않습니다.
서버 모드 실제 회원 화면은 기존 예시와 같은 3패널(왼쪽 판독 표·원본 파일 / 가운데 진행 분석 / 오른쪽 다음 수업)이며 2뷰와 모바일 단일 패널 전환을 지원합니다. 업로드 성공 시 업로드 창을 닫고 진행 분석을 표시합니다. 판독/분석은 완료 순서대로 실시간 반영됩니다.

‘예시 기록’ 자리는 실제 **판독 기록**으로 바꾸었습니다. 운동 행을 눌러 같은 패널 안에서 날짜·운동명·주 부위·중량·횟수·세트·메모를 수정합니다. 모든 행에 확인 체크를 요구하지 않습니다. 연도/회원 누락은 파일별 한 번에 보완하며, 불명확한 항목이 있어도 다른 기록으로 부분 분석을 먼저 제공합니다.

수정 시 비용 원칙:

- 원본 판독: 최초 한 번 저장. 트레이너의 값 수정/파일 재열람은 PDF·이미지를 Gemini에 다시 전송하지 않습니다.
- 세트/볼륨/부위 비중/선 그래프: 수정된 저장 값으로 코드가 즉시 계산합니다. AI 호출 없음.
- 종합 의견 + AI 수업 초안: 실제 분석 입력이 바뀌었을 때만 수정 내용을 모아 한 번의 응답으로 갱신합니다. 같은 값의 재저장/revision만 변경/원문 표기만 수정은 기존 분석 캐시를 재사용합니다.
- 트레이너가 직접 수정한 수업 계획 저장: AI 호출 없음. 이후 AI 의견 갱신에도 별도 저장 계획 보존.

클라우드 배포와 서버 플래그 활성화는 여전히 승인 대기입니다. 현재 3001의 기존 기능과 무료 베타 원가 제한 적용 상태를 혼동하지 않습니다.
추가 검증: 143개 테스트 통과. 에뮬레이터 브라우저에서 자동 업로드→분석 진입, 판독 표 안의 중량 수정(2,160→2,260 kg·회), 원본 재판독 없음, 2뷰/3뷰·모바일 전환 및 수정 계획 보존을 확인했습니다.
