# Firebase Hosting과 예시 관리

## 공개 웹 앱

- 프로젝트 / 사이트: `trainer-note-a9dd7`
- URL: https://trainer-note-a9dd7.web.app
- `npm run build`: Next.js 정적 출력 `out/` 생성.
- `npm start`: Hosting 에뮬레이터 http://localhost:5000 에서 빌드 결과 확인.
- `npm run deploy:hosting`: 빌드 후 Hosting만 배포. 기존 Functions / 데이터 규칙은 변경하지 않음.
- 로컬 개발은 계속 `npm run dev` (3001).
- Google 로그인 팝업을 위해 Hosting에서 `Cross-Origin-Opener-Policy: same-origin-allow-popups` 적용.
- `.env.local`에 Firebase Web 설정, 공개 App Check 사이트 키, 서버 AI 플래그를 설정한 뒤 빌드. 공개 웹 설정은 브라우저에 포함되지만 Gemini 키 / Admin 자격증명은 포함하면 안 됨.
- 운영 도메인은 Firebase Auth와 reCAPTCHA Enterprise 허용 도메인에 포함되어야 함. 새 커스텀 도메인 추가 시 두 설정도 확인.
- 프로덕션 빌드에는 App Check 디버그 토큰이 포함되지 않도록 점검.
- 로그인·회원 접근은 기존 Firebase 인증 / Firestore / Storage 규칙을 사용. 정적 배포로 개인 기록을 공개하지 않음.

## 예시 둘러보기

예시 메뉴는 현재 작업실의 탭과 공통 컴포넌트를 사용한다: 2뷰·3뷰, 원본, 기록 입력, 요약 그래프, 부위별 분포, 변화 추이, 목표 평가, 다음 수업, AI 도우미.

`src/components/demo-scenarios.ts`의 `DemoScenario` 목록에 검증된 양식을 추가한다. 각 예시는 안정적인 ID, 제목, 설명, 가상 또는 사용 허가를 받은 익명화 기록, 목표를 갖는다. 실제 회원 이름·연락처·원본 파일을 Git에 넣지 않는다. 추후 양식 테스트 때 사용자와 확인한 예시를 1~2개씩 추가한다.

현재는 기존 중량·횟수 양식 1종(5회 수업)을 제공한다. 원본 표와 통계는 같은 fixture에서 생성되며 합계를 따로 하드코딩하지 않는다. 원본은 그대로 두고 기록을 수정하면 같은 화면의 통계가 변경된다. 예시 초기화 / 화면을 나갔다 다시 들어오면 복원된다.

예시는 실제 Firebase 문서를 만들거나 AI 요청을 보내지 않는다. 다음 수업과 도우미 답변은 미리 작성한 체험임을 명시한다. 문답·평가 결과는 모델 품질 검증 결과로 사용하지 않는다. 실제 로그인 후의 회원 작업실에서 업로드·AI 분석을 테스트한다.

## 2026-09-14 배포 검증

- 정적 빌드·타입 검사 통과, 에뮬레이터 회귀/보안 규칙/유닛 테스트 355개 통과.
- 브라우저 예시: 기록 중량 수정 후 4,414 → 4,474 kg·회 반영, 원본 유지, 그래프→원본 이동, 목표 평가·다음 수업·도우미·390px 화면 확인.
- 운영 HTML·favicon HTTP 200, 로그인 팝업 확인. Auth와 reCAPTCHA에 운영 도메인 등록 확인. 운영 계정 선택 후 회원 조회는 사용자 로그인 후 확인 필요.
- 배포 파일에서 App Check 디버그 토큰·환경변수 파일·소스맵 제외 확인.
