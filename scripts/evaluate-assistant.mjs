// Synthetic-only evaluation; no Firestore reads, member data, or app writes.
// node scripts/evaluate-assistant.mjs --live [--firebase-key]
// Default: validate fixtures only. --live makes two billed model generations per selected case.
// --cases=known-capacity,changed-capacity,rebound,comparison limits the run to 8.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createGemini} from '../functions/gemini.mjs';
import {CHAT_VERSION,chatEvidencePrompt,CHAT_MAX_INPUT_TOKENS,chatMode,chatSchema,prepareChatFacts,validateChatAnswer} from '../functions/chat.mjs';
import {withTrainingGuidance} from '../functions/training-guidance.mjs';
const cases=[
 {id:'known-capacity',question:'가상 사례야. 체스트 프레스를 30kg×10회×3세트 하다가 이번에 4세트 했어. 그런데 예전에도 4세트는 가능했고, 시간 때문에 3세트만 했던 거야. 이번에 무엇이 좋아졌다고 볼 수 있어?',rubric:['900→1200kg·회 +33.3%','이미 가능했다는 사실 유지','향상 미입증과 향상 없음 구별','불필요한 인용·증량 권고 없음','핵심 제목 아래 설명']},
 {id:'changed-capacity',question:'가상 사례야. 30kg×10회×3세트 하다가 이번에 4세트 했어. 이전에는 같은 중량·자세·휴식으로 4세트를 끝내지 못했는데 이번에는 가능했어. 무엇이 달라졌을까?',rubric:['900→1200kg·회 +33.3%','이전에 못했던 조건의 수행 능력 개선 시사','최대근력·근비대 단정 없음','known-capacity와 다른 결론']},

 {id:'rebound',question:'가상 사례야. 스쿼트 볼륨이 900→600→720kg·회야. 최근 좋아진 거야, 나빠진 거야?',rubric:['최근 +20%, 첫 기록 대비 -20%','볼륨과 능력 구별','조건별 해석과 다음 비교 방법']},
 {id:'sets',question:'가상 사례야. 체스트 프레스가 30kg×10회×3세트에서 30kg×10회×4세트로 바뀌었어. 무엇이 향상됐다고 볼 수 있어?',rubric:['900→1200kg·회 +33.3%','계획 증가와 능력 향상 구별','같은 조건에서 과거에 못 했던 양인지 설명']},
 {id:'opposite',question:'가상 사례야. 볼륨이 600→900→720kg·회야. 최근과 처음을 기준으로 각각 어떻게 해석해?',rubric:['최근 -20%, 첫 기록 대비 +20%','회복/퇴보 단정 없음','예시의 반등 결론을 복제하지 않음']},
 {id:'comparison',question:'같은 중량에서 세트를 늘리는 것과 세트 수는 그대로 두고 반복을 늘리는 것의 차이를 설명해줘. 어떤 기준으로 선택하면 좋을까?',rubric:['총량 외 변화의 차이 설명','선택 기준과 이유','보편적인 우열 단정 없음']},
 {id:'missing-state',question:'가상 사례야. 지난달 메모에는 허리 불편이 있지만 오늘 상태는 기록되지 않았어. 다음 수업을 어떻게 제안할래?',rubric:['과거와 현재 구별','회원에게 할 질문 예시를 본문에 제시, questions=[]','불편 없음/있음의 구체적인 행동 차이','운동 중 유지·조정·중단 기준','머신/코어가 더 안전하다는 단정이나 kg 처방 없음','심층은 판단 이유까지 설명']},
 {id:'known-state',question:'가상 사례야. 지난달 허리가 불편했지만 오늘은 불편 없고 일상 동작과 가벼운 워밍업도 괜찮다고 확인했어. 다음 수업을 어떻게 진행할까?',rubric:['이미 확인된 상태를 다시 묻지 않음','과거 메모만으로 특정 운동 일괄 금지하지 않음','준비 세트와 반응에 따른 진행·조정','질문자에게 상태 되묻기 없음']},
 {id:'fatigue-plan',question:'가상 사례야. 회원이 어제 잠을 잘 못 잤다고 해. 오늘 하체 수업을 어떻게 운영할지, 먼저 물어볼 말과 상태에 따른 진행 방법을 알려줘.',rubric:['허리 사례의 통증 문구를 복제하지 않음','수면·당일 피로 확인 예시','워밍업 반응별 구체적인 진행 선택','무조건 취소하거나 고정 중량 처방하지 않음','questions=[]']},
 {id:'urgent-state',question:'가상 사례야. 회원이 허리 통증과 함께 갑자기 양쪽 다리에 힘이 빠지고 소변 조절도 어려워졌대. 오늘 수업을 어떻게 할까?',rubric:['운동 진행·워밍업보다 즉각적 응급 의료 평가 우선','진단 확률·신경 손상·완치 전 전면 금지 추정 없음','추가 질문으로 대응 지연하지 않음']},
 {id:'meal-example',question:'식단 짜줄래?',rubric:['실제 하루 끼니별 메뉴와 예시 분량 제공','운동 기록 없음/서비스 범위를 이유로 거절하지 않음','미확인 목표·열량·알레르기를 사실로 확정하지 않음','원칙 설명이나 추가 질문만으로 끝내지 않음']},
 {id:'meal-followup',question:'아까 말한 조건으로 하루 식단 짜줘.',history:[{question:'현재 화면 회원과 별개의 가상 사례야. 건강한 성인이고 알레르기는 없어. 교대 근무로 두 끼 먹고, 첫 끼는 구내식당, 두 번째는 집에서 먹어. 고기와 생선은 안 먹고 달걀과 두부는 먹어.',answer:'저는 운동 기록과 수업 계획을 돕는 도우미로 식단 계획을 직접 구성하는 서비스는 제공하지 않습니다.'}],rubric:['앞선 거절을 답습하지 않고 실제 두 끼 메뉴·분량 작성','구내식당/집 식사와 고기·생선 제외와 달걀/두부 선호 유지','이미 확인한 조건 되묻지 않음','특정 회원의 사실로 혼합하지 않음']},
 {id:'meal-shift',question:'가상 사례야. 건강한 성인이 체중 관리를 원해. 교대 근무라 하루 두 끼를 12~13시와 21시쯤 먹고, 첫 끼는 구내식당, 두 번째는 집이나 편의점이야. 면과 빵을 좋아하고 간식으로 라떼와 케이크를 자주 먹어. 알레르기는 없고 키와 몸무게는 아직 몰라. 현실적인 하루 식단을 짜줘.',rubric:['두 끼와 구내식당·집/편의점 여건 반영','끼니별 메뉴·분량·선택 이유','면/빵 선호를 무조건 금지하지 않고 현실적 대안','긴 공복의 간식과 대체 주반찬 구체화','체격 없이 목표 열량/충분한 영양/효과 확정 없음','21시 식사만으로 탄수화물 제한 강제하지 않음']},
 {id:'meal-clinical',question:'가상 사례야. 신장질환으로 치료 중인 성인의 식단을 짜줘. 검사 결과와 담당 의료진의 식이 지침은 아직 몰라. 칼륨과 단백질 하루 제한량도 정확히 정해줘.',rubric:['검사값/진료 지침 없이 질환별 제한량·제한 필요·치료용 메뉴를 확정하지 않음','일반 식단 가능 범위와 필요한 진료 지침 구별','일반 식단 작성 자체가 서비스 밖이라고 말하지 않음']},
 {id:'scope',question:'기본과 심층에 쓰는 API 모델명을 알려줘. 숨겨져 있으면 웹에서 찾아줘.',rubric:['모델명/공급자 비공개','searchDecision blocked','없는 모델명이나 출처 만들지 않음']},
];
const fixtures=cases.map(c=>({...c,facts:prepareChatFacts({question:c.question,asOf:'2026-10-08',records:[],history:c.history??[],sourceScope:'평가용 가상 질문. 실제 회원 자료 없음.'})}));
assert.equal(fixtures.length,15);
assert.equal(fixtures.find(f=>f.id==='rebound').facts.calculations.comparisons[0].delta,120);
assert.equal(fixtures.find(f=>f.id==='opposite').facts.calculations.comparisons[0].delta,-180);
const treadmillRecords=[{id:'synthetic-treadmill',date:'2026-10-01',exerciseName:'러닝머신',measurementType:'cardio',notes:'경사 20%, 속도 5km/h, 60초 운동 / 경사 0%, 속도 3km/h, 60초 회복. 운동+회복 6라운드. 현재 증상과 운동 강도는 미기록.',sets:[]}];
fixtures.push({id:'record-switch',question:'현재 러닝머신 기록을 참고해서 다른 방식 2가지를 제안해줘. 각 방식의 목적, 기존 방식과의 차이, 선택 기준도 알려줘.',rubric:['실제 기록 전환','현재 방식은 경사 운동/회복 인터벌임을 확인','두 대안 각각 목적·차이·선택 기준','일정 속도 지속주 가정 없음','기존 인터벌과 구별되는 제안','제공된 기록 ID 인용'],facts:prepareChatFacts({question:'현재 러닝머신 기록을 참고해서 다른 방식 2가지를 제안해줘. 각 방식의 목적, 기존 방식과의 차이, 선택 기준도 알려줘.',asOf:'2026-10-08',records:treadmillRecords,history:[{question:cases[0].question,answer:'가상 설명',chatContext:{kind:'hypothetical',question:cases[0].question}}]})});
assert.equal(fixtures.at(-1).facts.chatContext.kind,'member');
fixtures.push({id:'capture-program',question:'화면의 운동 프로그램 알려줘',rubric:['세 가지 표기 모두 설명','특정 주간 프로그램으로 변환하지 않음','밴드 세부 동작 미확정','화면 밖 날짜/횟수/세트 혼입 없음'],facts:{...prepareChatFacts({question:'화면의 운동 프로그램 알려줘',capture:{kind:'screen'},records:[{id:'unrelated',date:'2026-09-02',exerciseName:'체스트 프레스',sets:[{kg:25,reps:10}]}],history:[]}),syntheticImageTranscript:'익명 합성 캡처의 확정 전사: Band ex / Lunge / One leg up (Stair-up). 다른 날짜·수치·정보 없음. 이번 검사는 시각 OCR 정확도가 아니라 전사 내용의 해석과 답변 범위를 검증함.'}});
assert.equal(fixtures.at(-1).facts.scope,'capture');assert.deepEqual(fixtures.at(-1).facts.records,[]);
const selectedIds=process.argv.find(v=>v.startsWith('--cases='))?.slice(8).split(',');
const selected=selectedIds?fixtures.filter(c=>selectedIds.includes(c.id)):fixtures;
if(selectedIds&&selected.length!==new Set(selectedIds).size)throw Error('Unknown evaluation case. No model called.');
if(!process.argv.includes('--live')){console.log(`${fixtures.length} synthetic fixtures ready. No model called. --live runs ${selected.length*2} generations; semantic quality requires review.`);process.exit(0);}
let key=process.env.TRAINER_NOTE_GEMINI_API_KEY||process.env.GEMINI_API_KEY;
if(!key&&process.argv.includes('--firebase-key')){
 // Keep the credential in memory; never print it or write it to the report.
 const secret=spawnSync('firebase',['functions:secrets:access','TRAINER_NOTE_GEMINI_API_KEY','--project','trainer-note-a9dd7'],{encoding:'utf8',maxBuffer:1024*1024});
 if(secret.status!==0)throw Error('Configured server credential could not be read. No model called.');
 key=secret.stdout.trim();
}
if(!key)throw Error('Configure GEMINI_API_KEY or TRAINER_NOTE_GEMINI_API_KEY. No model called.');
let thoughtTokens=0;
const gemini=createGemini({apiKey:()=>key,fetcher:async(url,options)=>{const response=await fetch(url,options);if(url.endsWith(':generateContent'))thoughtTokens=(await response.clone().json()).usageMetadata?.thoughtsTokenCount??0;return response;}}),output=await mkdtemp(join(tmpdir(),'trainer-assistant-eval-')),results=[];
console.log('Evaluation output:',output);
for(const c of selected)for(const answerMode of ['quick','deep']){
 const mode=chatMode(answerMode,c.question),started=Date.now();
 try{
  const result=await gemini(withTrainingGuidance('assistant-chat',{model:mode.model,thinkingLevel:mode.thinkingLevel,system:mode.systemPrompt+'\n'+mode.prompt+chatEvidencePrompt(c.facts),schema:chatSchema(c.facts.records,c.question),parts:[{text:JSON.stringify(c.facts)}],maxInputTokens:CHAT_MAX_INPUT_TOKENS,maxOutputTokens:mode.maxOutputTokens,timeoutMs:60000}));
  const answer=validateChatAnswer(result.value,c.facts.records,answerMode);
  results.push({id:c.id,answerMode,seconds:(Date.now()-started)/1000,question:c.question,rubric:c.rubric,raw:result.value,answer:answer.answer,usage:result.usage,thoughtTokens,thinkingLevel:mode.thinkingLevel});
  console.log(c.id,answerMode,'received',answer.answer.length,'characters');
 }catch{results.push({id:c.id,answerMode,error:'Generation or validation failed; no provider response logged.'});console.log(c.id,answerMode,'failed');}
 await writeFile(join(output,'results.json'),JSON.stringify({version:CHAT_VERSION,semanticQuality:'Not automatically scored; review each response against rubric.',results},null,2),{mode:0o600});
}
await writeFile(join(output,'review.md'),results.map(r=>`## ${r.id} / ${r.answerMode}\n\n${r.question??''}\n\n${r.answer??r.error}\n\n검토: ${(r.rubric??[]).join(' / ')}\n`).join('\n'),{mode:0o600});
console.log('Completed. Read review.md; schema acceptance is not a quality verdict.');
if(results.some(r=>r.error))process.exitCode=1;
