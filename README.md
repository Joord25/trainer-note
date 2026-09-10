# 트레이너 노트

기준 개발 폴더: `/Users/joord/Desktop/Joord/trainer-note`

## 실행

이 폴더에서 `npm run dev` 후 http://localhost:3001 을 엽니다.
검증: `npm run build`, `npm run typecheck`.

## 현재 구현

- Firebase Google 로그인, 로그인 상태 유지, 계정 표시 및 로그아웃
- 회원 목록, 파일 업로드와 원본 미리보기, 2뷰·3뷰 작업 화면
- Kenko 전신 그래픽: 앞·뒤 전환, 부위별 비율, 이두·삼두 구분, 클릭·호버 강조
- 세트·볼륨 선 그래프와 원본 기록 연결
- 종합 의견 및 다음 수업 프로그램 초안 UI
- 화면 폭에 따른 배치, 탭 전환 시 스크롤 초기화

현재 회원 A의 분석은 예시 데이터입니다. 실제 업로드 파일은 브라우저에서만
열리고, 새로고침하면 초기화됩니다. Firebase 로그인은 연결되어 있으며,
회원 데이터의 영구 저장·Gemini 판독은 아직 연결되지 않았습니다.

2026-09-11: Documents/ChatGPT/Trainer-Note에서 작업했던 최신 UI를 이 폴더에 반영했습니다.
이후 앱 개발은 이 폴더를 기준으로 진행합니다.

## Firebase Authentication

- Firebase 프로젝트: `trainer-note-a9dd7`
- 웹 앱: `trainer-note-web`
- 관리 계정: `trainer.note.app@gmail.com` (서비스 로그인은 각 트레이너의 Google 계정 사용)
- 설정: `.env.example`의 공개 Web SDK 설정을 `.env.local`에 작성 후 개발 서버를 실행합니다.
- Firebase Auth: Google 로그인 활성화, `localhost` 허용 도메인 확인 완료.
- Auth 설정 배포: `npx -y firebase-tools@latest deploy --only auth --project trainer-note-a9dd7`
- `firebase.json`의 도메인 선언 외에 Firebase Console의 실제 Authorized domains도 확인해야 합니다. 운영 주소는 도메인만 추가합니다.
- 로그인 전에는 작업 화면을 렌더링하지 않습니다. 계정 UID 변경/로그아웃 시 작업 화면을 해제하여 임시 파일 URL과 입력 상태를 지웁니다.
- 로그인은 브라우저 local persistence를 사용합니다. 공용 기기에서는 사용 후 로그아웃합니다.

현재 AuthGate는 클라이언트 화면 전환을 담당합니다. 서버 API 인증이나 데이터 접근 권한을 대신하지 않습니다.
Firestore/Storage 연결 시 UID별 경로 및 Security Rules를 적용하고, 서버 API에서는 ID 토큰을 검증해야 합니다.
Admin SDK 비밀 키는 브라우저나 NEXT_PUBLIC 환경변수에 넣지 않습니다.

### 실제 계정 확인

`http://localhost:3001`에서 Google로 계속하기 → 본인 계정 선택 → 사이드바 계정 표시를 확인합니다.
새로고침 시 로그인 유지 → 로그아웃 시 로그인 화면 복귀 → 다른 계정 로그인 시 임시 작업 초기화를 확인합니다.
브라우저에서 직접 Google 인증을 마치는 과정은 사용자 확인이 필요합니다.

2026-09-11 검증: production build 및 TypeScript 통과. 별도 브라우저에서
비로그인 화면 제한, Google OAuth 계정 화면 도착, 팝업 취소 시 한글 오류 및 재시도,
새로고침 후 비로그인 유지, 375px 모바일 레이아웃을 확인했습니다.
실제 Google 계정 로그인 완료·로그인 유지·로그아웃은 아직 사용자가 확인하기 전입니다.
