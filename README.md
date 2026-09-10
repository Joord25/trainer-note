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
회원별 PDF 저장 코드는 구현되어 있으며, 운영 Storage 버킷 연결을 기다리는 상태입니다. Gemini 판독·실제 운동 분석은 아직 연결되지 않았습니다.

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
Firestore 회원 정보에는 UID별 경로 및 Security Rules를 적용했습니다. Storage에도 소유자 규칙을 작성했으며 버킷 연결 후 배포해야 합니다. 서버 API에서는 ID 토큰을 검증해야 합니다.
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

다음 구현 순서: Storage 운영 활성화 → 판독 및 기록 확인 → 확정 기록으로 집계 → 근거를 포함한 분석과 수업 준비.

## 회원별 PDF 원본 저장 (2026-09-11)

구현: 회원 선택 후 PDF 최대 10개 업로드(파일당 50MB), 진행률·중단, 실시간 파일 목록,
새로고침 후 유지, 인증된 PDF 미리보기·내려받기·삭제. 내용의 SHA-256으로 같은 회원의 동일 PDF 중복을 막습니다.
브라우저는 PDF 확장자·크기·헤더를 검사합니다. 원본 저장은 판독 완료를 뜻하지 않습니다.

- Firestore: `trainers/{uid}/members/{memberId}/files/{sha256}`에 파일명·크기·상태·서버 시각.
- Storage: 동일 경로 아래 `source.pdf`. 다른 계정 및 비로그인 접근을 거부합니다.
- 업로드 전 연결 정보를 예약하고 회원 `fileCount`와 원자적으로 갱신합니다. 기존 회원은 0개로 처리합니다.
- 업로드 중단 후에는 ‘저장 확인’으로 완료된 원본을 확인하거나 항목을 삭제 후 다시 올립니다.
- 삭제는 상태 변경 → 원본 삭제 → 연결 정보·카운터 갱신 순서입니다. 중단되면 목록에서 삭제를 재시도합니다.
- 브라우저 미리보기는 인증된 `getBlob`과 임시 URL을 사용하고 닫기/회원 전환/로그아웃 시 URL을 해제합니다.

검증: 빌드 및 규칙 테스트 **34개** 통과. 실제 컴포넌트·SDK와 Firestore/Storage 에뮬레이터를 사용한
브라우저 검사에서 PDF 업로드, 새로고침, Blob 미리보기, 중복·잘못된 PDF 차단, 계정별 분리,
삭제 후 회원 삭제 가능 상태, 모바일 가로 넘침 없음, JavaScript 오류 없음을 확인했습니다.
테스트에는 실제 Google 계정 대신 에뮬레이터 UID를 사용했습니다. 운영 Storage 검증은 아직입니다.

### 운영 활성화 조건

현재 프로젝트는 결제 계정 및 Storage 버킷 미연결 상태입니다. `NEXT_PUBLIC_STORAGE_ENABLED`가
`true`일 때만 파일 기능을 활성화합니다. 현재 `.env.local`에는 이 값을 추가하지 않았으므로 준비 안내가 보입니다.
이 환경변수는 UI 활성화 값이며 보안 장치가 아닙니다. 권한은 서버 규칙으로 검사합니다.

1. 프로젝트 소유자가 Firebase Console에서 Blaze 결제 계정 연결 및 Storage 버킷 생성(위치 확인).
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
