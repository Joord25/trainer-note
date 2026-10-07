<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 운영 전환 전 확인 사항 (사용자 요청, 2026-10-07)

- 현재 로컬 테스트를 위해 허용한 개발용 Firebase App Check 접근은 운영 전환 시 정리해야 한다. 사용자가 나중에 제거할 수 있도록 기억해 달라고 요청했다.
- 운영 전환 작업에서는 Firebase에 등록한 개발용 App Check 디버그 토큰을 폐기하고, 로컬 환경의 `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` 및 관련 개발 예외를 정리한다. 코드에서 환경변수를 제거하는 것만으로 등록된 토큰이 폐기되는 것은 아니다.
- 개발·운영 Firebase 프로젝트 분리를 검토하고, 로컬에서 운영 서버에 접근하는 개발 경로가 차단됐는지 확인한다. 로그인·회원 소유권·App Check 검증은 유지한다.
- 지금은 개발·테스트 중이므로 이 메모만을 근거로 토큰을 즉시 폐기하거나 로컬 테스트 접근을 중단하지 않는다. 운영 전환 때 이 항목을 다시 확인한다.
