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
회원별 PDF·PNG·JPEG 저장 코드와 실제 Storage 버킷 연결이 완료됐습니다. 로컬 3001 환경에서 업로드 기능을 활성화했습니다. 직접 확정한 운동 기록의 저장·집계가 연결됐습니다. Gemini 자동 판독과 AI 종합 분석은 아직입니다.

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

다음 구현 순서: Gemini 판독 및 기록 확인 연결 → 확정 기록으로 집계 확장 → 근거를 포함한 분석과 수업 준비.

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
자동 판독과 App Check 설정은 후속 작업이며 현재 AI 서비스를 초기화하거나 호출하지 않습니다.

### 이미지 업로드 지원 (2026-09-11)

운동일지 **파일 추가**에서 PDF·PNG·JPG·JPEG를 함께 선택하거나 끌어올 수 있습니다.
파일당 50MB, 한 번에 10개 제한은 동일합니다. 파일 목록에는 형식이 표시되고 이미지에는 이미지 미리보기를 제공합니다.
업로드 진행·중단·저장 확인·삭제 흐름은 PDF와 같습니다. 같은 JPEG를 .jpg/.jpeg로 다시 올려도 내용 해시로 중복을 검사합니다.
기존 source.pdf 경로를 변경하지 않아 저장된 PDF를 계속 열 수 있습니다.

Firestore는 세 가지 MIME만 허용하며, Storage는 예약 문서 MIME·요청 MIME·고정 파일 경로를 대조합니다.
형식 시그니처 검사는 전체 이미지 디코딩이나 악성 파일 검사를 대신하지 않습니다. AI 처리 단계에서는 별도 파싱이 필요합니다.
규칙/형식 테스트 총 86개 통과. 브라우저에서 PDF 회귀, PNG·JPEG 업로드·재조회·디코딩된 미리보기·삭제,
JPG/JPEG 중복 방지, 로컬 기록 대조 이미지, 계정 분리와 모바일 레이아웃을 확인했습니다.
