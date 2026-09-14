# 1,000명 운영 준비 점검 — 2026-09-14

## 결론과 범위

가입 이용자 1,000명을 목표로 점검했다. 동시 접속 1,000명이나 동시 AI 요청 1,000건을 수용한다고 검증한 것은 아니다. Firebase의 계정별 데이터 경계는 있지만 공개 운영 준비는 아직 완료되지 않았다. 초기 검증 시나리오는 가입 1,000명 / 동시 화면 이용 50명 / AI 요청 동시 10명으로 두고 실제 사용 패턴에 맞춰 조정한다. 아래 가상 부하 시험은 **집계 계층만** 검사한다.

## 실제 운영 설정에서 확인한 내용

| 항목 | 확인 결과 | 판단 |
|---|---|---|
| Firestore / Storage 소유권 | UID 경로 기반 읽기·쓰기 및 삭제 중 접근 차단 | 계정 간 분리 규칙 유지 |
| trainerAi / trainerAccount | Auth 필수, App Check enforceAppCheck=true | callable 공개 HTTP 진입은 SDK 호출에 필요하며 앱 내부 인증도 수행 |
| 보고서 / 계정 정리 작업 | Cloud Run 서비스에 공개 invoker 없음, 프로젝트 공개 IAM binding 없음 | 일반 브라우저에서 직접 실행하는 공개 작업 아님 |
| trainerAi | 인스턴스 3개 × 동시 요청 4개 | 설정상 12건, 이용자 수나 성능 보장 수치가 아님 |
| 원본 판독 | 인스턴스 3개 × 동시 요청 4개 | callable과 별도 자원·Gemini 요청 사용 |
| 보고서 대기열 | 동시 dispatch 1건, 초당 dispatch 1건, maxAttempts=1 | 여러 이용자 업로드 시 대기 병목 |
| 함수 실행 계정 | 기본 Compute 서비스 계정, roles/editor 포함 | 최소 권한 분리 필요 |
| Firestore / Storage App Check | 서비스 설정에 ENFORCED 없음 | 정상 앱 토큰 지표 확인 후 강제 적용 필요 |
| Firestore 삭제 방지 | DISABLED → ENABLED 적용·재조회 완료 | DB 전체 삭제 방지, 일반 회원/문서 삭제와 별개 |
| Firestore PITR | 비활성화 | 복원 정책·비용 결정 및 복구 리허설 필요; 예약 백업 존재 여부는 미확인 |
| Gemini RPM / TPM / 일일 한도 | 실제 프로젝트 한도 미확인 | AI Studio 한도와 실측 응답 시간 확인 전 대규모 처리량 증설 보류 |

## 이번 보완

- 모든 AI 요청이 월별 공통 문서 하나에 쓰던 집계를 64개 shard로 분산했다. 사용자 화면의 개인 사용량 문서는 유지한다.
- 전체 사용량 = 기존 `aiGlobalUsage/{month}` 수치 + `shards/00`~`63` 합계다. 기존 월별 문서만 조회하면 새 사용량이 누락되므로 운영 집계에서 반드시 합산한다. 호출 문서에 사용한 shard ID를 남긴다.
- 일·월 제한은 기존 요청대로 null(무제한)을 유지했다. 향후 전체 비용 제한을 켜면 기존 합계와 모든 shard의 확정/예약 금액을 트랜잭션에서 함께 확인한다. 이 모드는 정확한 제한을 우선하여 공유 읽기 병목이 다시 생길 수 있다.
- trainerAi에 UID별 **동시 4건 / 순간 여유 20건 / 분당 60건 속도로 회복**하는 서버 요청 방어를 추가했다. 하루나 월간 질문 횟수 제한이 아니다. 190초 임대 만료로 비정상 종료 후에도 잠금이 영구 유지되지 않는다.
- 요청 본문을 1MiB 이하로 검증한다. 기존 캡처 제한(500,000자)은 그대로 통과한다.
- 요청 방어 데이터·공통 사용량은 클라이언트가 수정할 수 없음을 규칙 테스트로 확인했다.
- 위 요청 방어는 trainerAi callable 대상이다. Firestore 직접 쓰기로 발생하는 자동 원본 판독·보고서, 여러 계정을 생성하는 공격 전체를 막는 기능은 아니다.
- 데이터베이스 전체 삭제 방지를 운영에 적용했다. 사용량 제한·최대 인스턴스·작업 큐 처리량은 이번 점검에서 변경하지 않았다.

## 검증

1. 로컬 Firestore 에뮬레이터, 가상 계정 1,000개, 동시 집계 요청 40건, 가짜 모델(유료 호출 0건).
2. 1,000건 모두 정상 정산, 계정별 호출 1건, 공통 합계 일치, 남은 예약 금액 0. 64개 shard 사용.
3. 해당 로컬 실행에서 검증 포함 약 4.7초, 집계 요청 p95 약 103ms. **운영 네트워크·콜드 스타트·이미지 다운로드·Gemini 응답 시간은 포함하지 않는다.**
4. 전체 회귀 테스트 362개 통과, 선택적 부하 테스트 1개는 기본 실행에서 건너뜀. 부하 테스트는 별도 실행에서 통과.
5. 실제 사용자 로그인 / 50개 브라우저 / 유료 Gemini 부하 시험 및 계정 삭제 실데이터 시험은 실행하지 않았다.

재실행: `TN_CAPACITY_TEST=1 node --test functions/tests/capacity.test.mjs`를 demo-trainer-note Firestore 에뮬레이터에서 실행한다. 운영 환경에서는 테스트가 거부된다.

## 배포 확인

- `trainerAi`, `readUploadedWorkout`, `buildMemberReport` 업데이트 완료. 기존 인스턴스·동시성 설정 유지.
- 인증 없는 빈 POST 요청: trainerAi / trainerAccount는 401, buildMemberReport / purgeTrainerAccount는 403으로 거부됨.
- 실제 사용자 계정이나 회원 데이터를 조회·변경하는 운영 테스트는 수행하지 않음.

## 공개 운영 전 작업 순서

1. **실행 권한 분리**: AI(필요 DB 작업, 원본 읽기, 해당 Gemini secret, 보고서 enqueue), 기록 동기화(필요 DB 작업, enqueue), 탈퇴 정리(Auth 삭제, 회원 DB/원본 삭제)를 별도 서비스 계정으로 분리한다. 큐 enqueue/호출용 IAM과 Eventarc 권한도 각각 검증한다. 기존 공용 계정의 Editor를 먼저 제거하면 빌드·작업 큐·탈퇴 기능이 중단될 수 있으므로 새 계정으로 전환한 후 제거한다.
2. **App Check 적용**: 운영 도메인의 정상 로그인·읽기·업로드 및 토큰 유효율을 확인한 뒤 Firestore와 Storage를 차례로 ENFORCED로 전환한다. 정상 요청도 토큰이 없으면 차단되므로 지표와 브라우저 검증 없이 일괄 전환하지 않는다.
3. **큐와 모델 처리량**: 실제 Gemini RPM/TPM/RPD와 사용자별 평균 호출 수(한 질문이 검색 검토·검색·합성 등 여러 모델 호출을 유발할 수 있음)를 확인한다. 이후 trainerAi 최대 10×4, 보고서 2×2 / 동시 dispatch 4건 등을 첫 증설 후보로 시험한다. 현재 적용값이 아니다. 자동 판독까지 포함한 전체 모델 호출률을 계산한다.
4. **처리 보장**: 트리거 retry=false / 작업 maxAttempts=1의 실패 복구, 장시간 processing 상태 회복, 운영 함수 종료 시 남는 비용 예약, 여러 보고서 작업이 겹칠 때 최신 결과 보존을 검사한다. 자동 재시도는 중복 과금 방지를 확인한 뒤 추가한다.
5. **운영 관측**: 429/5xx, p95 응답 시간, 가장 오래 기다리는 작업, 실패율, 예약 미정산 건, 일별 토큰/실청구 비용을 관측하고 알림을 연결한다. 사용량 무제한과 비용 알림은 별개로 운영할 수 있다.
6. **복구·저장 공간**: PITR/백업 보존 기간과 복구 테스트, 계정별 누적 원본 용량·파일 생성 속도 관리가 필요하다. 현 규칙은 회원별 500파일/5,000기록이지만 계정 전체 회원 수·누적 용량 제한은 아니다.
7. **화면 부하**: 회원 목록·원본 판독 결과·운동 기록의 전체 컬렉션 구독을 큰 회원 데이터로 측정하고 필요하면 페이지 조회/범위 구독으로 바꾼다. 다른 트레이너의 데이터까지 읽는 구조는 아니다.

## 근거

- [Firebase 함수 인스턴스·동시성](https://firebase.google.com/docs/functions/manage-functions)
- [Firestore 분산 카운터](https://firebase.google.com/docs/firestore/solutions/counters)
- [Cloud Tasks 작업 대기열](https://firebase.google.com/docs/functions/task-functions)
- [App Check 강제 적용과 정상 요청 검증](https://firebase.google.com/docs/app-check/enable-enforcement)
- [Firestore 데이터베이스 삭제 방지](https://firebase.google.com/docs/firestore/manage-databases)
- [Gemini API 한도](https://ai.google.dev/gemini-api/docs/rate-limits)
