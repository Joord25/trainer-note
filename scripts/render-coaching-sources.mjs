// Keep the readable source ledger in sync with the runtime registry.
import {writeFile} from 'node:fs/promises';
import {COACHING_SOURCES,COACHING_EVIDENCE_VERSION} from '../functions/coaching-evidence.mjs';
const levels={'full-text':'원문 확인',abstract:'초록 확인','official-page':'공식 교육 페이지 확인','official-summary':'공식 요약 확인'};
const content=`# 훈련 근거 출처 목록\n\n버전: ${COACHING_EVIDENCE_VERSION} · 검토: 2026-10-09\n\n[판단 기준과 적용 범위](./README.md)\n\n원문 전체를 저장하지 않은 자체 요약이다. 아래 자료는 같은 종류의 근거가 아니며 개인 처방으로 자동 변환하지 않는다.\n\n`+COACHING_SOURCES.map(s=>`## ${s.id}\n\n[${s.title}](${s.url})\n\n- 발행: ${s.year??'발행연도 미확정 · 현행 공개 자료'}\n- 자료 유형: ${s.type}\n- 대상: ${s.population}\n- 확인 범위: ${levels[s.reviewed]}${s.doi?'\n- DOI: '+s.doi:''}\n\n**핵심:** ${s.claim}\n\n**적용 한계:** ${s.limit}\n`).join('\n');
await writeFile(new URL('../docs/training-evidence/sources.md',import.meta.url),content);
