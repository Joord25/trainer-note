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
회원별 PDF·PNG·JPEG 업로드 → 원본·진행 분석·다음 수업 작업실 → Gemini 자동 판독·종합 의견·프로그램 생성이 연결됐습니다. 명확한 기록은 잠정 기록으로 바로 반영하고 필요한 값만 같은 화면에서 수정합니다. `EXPERT_JUDGMENT_PLAN.md`의 조건 검사·판단 카드·트레이너 피드백을 분석에 연결했습니다.

**2026-09-11 실제 서버 검증:** `gemini-3.1-flash-lite`, Cloud Functions 5개 및 규칙 배포, 가상 PDF 3일/6세트 자동 판독, 판단 카드 5개와 다음 수업 초안 저장, 동일 분석 재요청 시 추가 모델 호출 없음. localhost:3001의 서버 AI를 활성화했습니다. 자세한 범위와 남은 운영 확인은 [실제 연결 검증](docs/gemini-live-verification.md)을 보세요.

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

이후 단계: 실제 트레이너 사용 피드백 수집, 손글씨 예외 개선, 전문가 판단 사례와 실제 후속 성과 검증.

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


## Gemini 연결 설정

현재 기본은 서버 모드입니다. 예전 브라우저 AI Logic 판독 버튼/메모리 초안 흐름은 사용하지 않습니다.

```dotenv
NEXT_PUBLIC_SERVER_AI_ENABLED=true
NEXT_PUBLIC_AI_ENABLED=false
NEXT_PUBLIC_FIREBASE_AI_MODEL=gemini-3.1-flash-lite
NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY=your-public-recaptcha-enterprise-site-key
# 등록된 로컬 개발 토큰은 비밀로 유지합니다.
NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN=your-local-development-debug-token
```

서버 키는 Secret Manager의 `TRAINER_NOTE_GEMINI_API_KEY`로만 전달합니다. 로컬 환경 파일/Git/브라우저에 Gemini 비밀키를 넣지 않습니다. 모델은 서버 `functions/domain.mjs`에서 고정합니다.

App Check는 reCAPTCHA Enterprise 및 함수 `enforceAppCheck`를 사용합니다. 개발 빌드의 localhost/127.0.0.1에서만 등록된 debug token을 사용하고 운영 번들에는 포함하지 않습니다. 새 운영 도메인은 Auth와 reCAPTCHA 허용 도메인에 추가해야 합니다.
Firebase 브라우저 키에서는 `firebasevertexai.googleapis.com`을 제외하여 예전 직접 AI 호출의 원가 한도 우회를 막았습니다. Auth·App Check·Firestore·Storage 허용은 유지했습니다.

## 저장된 판독 · 자동 분석 · 무료 베타 서버 모드

**현재 상태:** `trainer-note-a9dd7`에 서버와 Firestore 규칙을 배포했고 `NEXT_PUBLIC_SERVER_AI_ENABLED=true`를 localhost:3001에 적용했습니다. 실제 Gemini 판독·리포트 및 캐시를 가상 회원으로 검증했습니다. 운영 회원의 손글씨 정확도와 목표 달성 예측 성능을 입증한 것은 아닙니다.

### 동작

- 새 파일 manifest가 ready로 바뀌면 서버가 PDF/PNG/JPEG 원본을 읽습니다. 10MB 이하, 해시·MIME·크기를 검증하고 기존 추출 프롬프트에 원본 자체 대조 지시를 추가했습니다.
- 원본 판독 JSON, 행별 검증 결과, 토큰 사용량을 회원의 `imports/{fileHash}`에 저장합니다. 동일 파일 재열람/새로고침은 추출을 재호출하지 않습니다. 기존 업로드 파일도 회원 작업실을 열면 미판독 파일부터 자동 처리합니다.
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

### 배포 구성 및 재배포

대상은 기존 **trainer-note-a9dd7**, codebase `trainer-ai`, region `us-central1`입니다. Auth/App Check callable `trainerAi`, 파일/기록/회원 트리거 3개와 단일 동시 실행 `buildMemberReport` 작업 큐를 사용합니다. 최소 인스턴스는 0이며 서버·빌드·작업 큐 비용은 모델 원가와 별도입니다. Artifact Registry에는 7일 보관 정책을 적용했습니다.

기존 Secret Manager의 최신 키를 바꾼 뒤에는 함수를 재배포해야 해당 비밀 버전이 적용됩니다. 키 값은 명령 인수나 채팅에 넣지 않습니다.

```sh
node scripts/build-functions.mjs
npx -y firebase-tools@latest deploy --only functions:trainer-ai,firestore:rules --project trainer-note-a9dd7 --account trainer.note.app@gmail.com
```

새 환경에서는 실제 호출·토큰 집계를 확인한 뒤 서버 플래그를 켭니다. 로컬 서버 플래그는 원격 트리거를 끄는 스위치가 아니며, 업로드 `ready` 이벤트는 배포된 서버에서 계속 처리됩니다.

### 검증

`npm install --prefix functions` 후 `npm run test:all` (Java 21+, 로컬 Firebase 에뮬레이터 필요).
서비스 테스트는 `FIRESTORE_EMULATOR_HOST`가 없으면 즉시 중단하며 라이브 DB에 접근하지 않습니다. Gemini와 큐 adapter는 제어된 테스트 대역을 사용합니다.

167개 테스트 통과: 중복/동시 판독, 캐시, 누락 연도·회원 일괄 보완, 트레이너 수정 충돌, 잠정 데이터 제외/재집계, 예산 동시 예약/실패 정산, 분석 변경 감지, 수업 계획 보존, 소유자 읽기·서버 전용 쓰기 및 기존 업로드/수동 기록 회귀.
별도 브라우저에서 실제 컴포넌트·Firestore/Storage SDK와 에뮬레이터를 연결해 자동 반영, 연도 보완 후 통계, 재열람/새로고침 시 AI 재호출 없음, 탭 전환 시 수업 입력 보존, 새 분석 후 저장된 계획 유지, 인체 그래픽/선 그래프, 모바일 가로 넘침 없음 및 런타임 오류 없음을 확인했습니다.

실제 Cloud Functions → Gemini → Firestore 저장 및 재요청 캐시는 가상 PDF로 통과했습니다. 실제 App Check 발급과 인증 없는 callable 차단도 확인했습니다. 로그인한 운영 브라우저의 전체 업로드 동선은 사용 환경에서 추가 확인합니다. 테스트 성공을 손글씨 판독 정확도나 목표 달성 예측 정확도로 해석하지 않습니다.


### UX 정정: 업로드 후 분석 화면이 기본 (2026-09-11)

사용자가 원한 기본 동선은 **업로드 → 자동 판독 → 진행 분석을 먼저 표시**입니다. 기록 입력/확정 목록을 통과하는 단계는 두지 않습니다.
서버 모드 실제 회원 화면은 기존 예시와 같은 3패널(왼쪽 판독 표·원본 파일 / 가운데 진행 분석 / 오른쪽 다음 수업)이며 2뷰와 모바일 단일 패널 전환을 지원합니다. 업로드 성공 시 업로드 창을 닫고 진행 분석을 표시합니다. 판독/분석은 완료 순서대로 실시간 반영됩니다.

‘예시 기록’ 자리는 실제 **판독 기록**으로 바꾸었습니다. 운동 행을 눌러 같은 패널 안에서 날짜·운동명·주 부위·중량·횟수·세트·메모를 수정합니다. 모든 행에 확인 체크를 요구하지 않습니다. 연도/회원 누락은 파일별 한 번에 보완하며, 불명확한 항목이 있어도 다른 기록으로 부분 분석을 먼저 제공합니다.

수정 시 비용 원칙:

- 원본 판독: 최초 한 번 저장. 트레이너의 값 수정/파일 재열람은 PDF·이미지를 Gemini에 다시 전송하지 않습니다.
- 세트/볼륨/부위 비중/선 그래프: 수정된 저장 값으로 코드가 즉시 계산합니다. AI 호출 없음.
- 종합 의견 + AI 수업 초안: 실제 분석 입력이 바뀌었을 때만 수정 내용을 모아 한 번의 응답으로 갱신합니다. 같은 값의 재저장/revision만 변경/원문 표기만 수정은 기존 분석 캐시를 재사용합니다.
- 트레이너가 직접 수정한 수업 계획 저장: AI 호출 없음. 이후 AI 의견 갱신에도 별도 저장 계획 보존.

클라우드 배포와 localhost:3001 서버 모드 활성화를 완료했습니다. 상세한 실제 검증 결과는 `docs/gemini-live-verification.md`에 기록합니다.
추가 검증: 143개 테스트 통과. 에뮬레이터 브라우저에서 자동 업로드→분석 진입, 판독 표 안의 중량 수정(2,160→2,260 kg·회), 원본 재판독 없음, 2뷰/3뷰·모바일 전환 및 수정 계획 보존을 확인했습니다.
