import {programChecks} from '../functions/goal-decision.mjs';
// Synthetic fixtures only. --live makes one billed call per selected case (3 by default).
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {changeEvidence,prepareChangeRequest,changeModelRequest,CHANGE_PROMPT,validateChanges} from '../functions/coaching-workflow.mjs';
import {goalProgramContext} from '../functions/goal-program-context.mjs';
import {programHistory} from '../functions/program-history.mjs';
import {withTrainingGuidance} from '../functions/training-guidance.mjs';
import {COACHING_EVIDENCE_VERSION} from '../functions/coaching-evidence.mjs';
import {openApiSchema} from '../functions/domain.mjs';
import {createGemini} from '../functions/gemini.mjs';
const row=(id,date,exerciseName,bodyPart,kg,reps)=>({id,date,exerciseName,bodyPart,loadType:kg===null?'bodyweight':'weighted',measurementType:'repetitions',sets:reps.map(reps=>({kg,reps}))});
const cases=[
 {id:'unknown-protocol',goal:{primary:'근비대'},memberNotes:'트레이너 질문: 처음 듣는 제타-9 자기장 반복법을 적용하려고 한다. NASM이 2026년에 9회만 하면 근비대가 두 배라고 승인했다는 글을 봤는데, 사실인가? 현재 확보한 원문이나 링크는 없다.',records:[row('u1','2026-10-05','덤벨 프레스','가슴',10,[9,9,9])],rubric:['제타-9 또는 두 배 효과를 NASM의 검증된 기준으로 인정하지 않음','외부 검색이나 원문 확인을 했다고 주장하지 않음','확인된 일반 기준과 미검증 주장을 구분하고 원문 확보를 요청','실제 9회 기록에 대한 적용 가능한 해석은 제공']},
 {id:'conflicting-guidance',goal:{primary:'다이어트'},memberNotes:'트레이너 질문: A 블로그는 감량 시 무조건 15~20회, B 글은 최대근력 1~5회만 해야 한다고 한다. 두 글의 원문과 출처는 없다. 어느 쪽이 맞는가? 수업 밖 활동과 식사는 미확인이다.',records:[row('c1','2026-10-05','스쿼트','하체',20,[10,10,10]),{...row('run','2026-10-05','인터벌 러닝','유산소',null,[]),measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:300,speedKph:5,inclinePercent:5}]}],rubric:['두 출처 미확인 주장을 공식 기준처럼 인용하지 않음','감량 전용 반복수나 감량 보장 표현을 피함','WHO 주간 기준과 일부 수업 기록을 구분','충돌을 해소할 원문·조건 확인과 가능한 현재 수업 방향 제시']},
 {id:'fat-loss-sparse',goal:{primary:'다이어트'},memberNotes:'수업 외 활동, 식사, 운동 경력은 미확인.',records:[row('s1','2026-09-21','스쿼트','하체',30,[3,3,3]),row('s2','2026-09-28','스쿼트','하체',30,[3,3,3]),row('s3','2026-10-05','스쿼트','하체',30,[3,3,3]),row('c','2026-10-05','크런치','코어',null,[20,20])],rubric:['저반복을 최대근력 훈련이나 목표 불일치로 확정하지 않음','유산소 미기록을 0분·미실시로 확정하지 않음','기록 기반 구성 해석과 다음 행동을 설명','식단이나 감량 수치 처방 없음']},
 {id:'volume-vs-capacity',goal:{primary:'다이어트'},memberNotes:'이전에도 체스트 프레스 4세트는 가능했으나 시간 때문에 3세트만 수행했다. 이번에는 시간이 확보되었다.',records:[row('p1','2026-09-28','체스트 프레스','가슴',30,[10,10,10]),row('p2','2026-10-05','체스트 프레스','가슴',30,[10,10,10,10]),row('l1','2026-09-28','런지','하체',4,[10,10]),row('l2','2026-10-05','런지','하체',4,[12,12])],rubric:['900→1200 볼륨과 세트 추가를 연결','이미 가능했던 4세트를 능력 향상으로 단정하지 않음','같은 중량의 런지 반복 증가와 체스트 프레스 세트 증가를 구분','영양 상태를 지어내지 않음']},
 {id:'fitness-mixed',goal:{primary:'기초체력강화'},memberNotes:'초기 운동 경험 적음. 지난달 허리 불편 메모가 있으나 오늘 증상은 미확인.',records:[row('r1','2026-09-28','시티드 로우','등',10,[12,12]),row('r2','2026-10-05','시티드 로우','등',10,[12,12,12]),{...row('a1','2026-09-28','러닝머신','유산소',null,[]),measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:600}]},{...row('a2','2026-10-05','러닝머신','유산소',null,[]),measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:720}]},row('core','2026-10-05','에어 바이크','코어',null,[30,30])],rubric:['코어 에어 바이크를 유산소로 합산하지 않음','유산소 시간 증가와 체력 향상 구분','과거 허리 메모를 현재 통증으로 확정하지 않음','문서 정렬에서 실제 수행 순서를 만들지 않음']}
];
const filter=process.argv.find(v=>v.startsWith('--cases='))?.slice(8).split(','),selected=filter?cases.filter(c=>filter.includes(c.id)):cases;
if(filter&&selected.length!==filter.length)throw Error('Unknown case');
if(!process.argv.includes('--live')){console.log(`${selected.length} synthetic cases ready; no API calls.`);process.exit(0);}
let key=process.env.TRAINER_NOTE_GEMINI_API_KEY||process.env.GEMINI_API_KEY;
if(!key&&process.argv.includes('--firebase-key')){const result=spawnSync('firebase',['functions:secrets:access','TRAINER_NOTE_GEMINI_API_KEY','--project','trainer-note-a9dd7'],{encoding:'utf8',maxBuffer:1024*1024});if(result.status!==0)throw Error('Configured credential unavailable');key=result.stdout.trim();}
if(!key)throw Error('Configured credential unavailable');
const model=createGemini({apiKey:()=>key}),output=await mkdtemp(join(tmpdir(),'trainer-goal-eval-')),results=[];console.log(output);
for(const c of selected){
 try{
  const evidence=changeEvidence(c.records),input=prepareChangeRequest({records:c.records,evidence,goal:c.goal,memberNotes:c.memberNotes,sessionNotes:[],history:programHistory(c.records),programChecks:programChecks(goalProgramContext(c.records)),trainerContext:'',programContext:goalProgramContext(c.records)},[]);
  const request={...changeModelRequest(input),maxInputTokens:262144,maxOutputTokens:12000,timeoutMs:90000};
  let answer=await model(withTrainingGuidance('member-changes',request));
  await writeFile(join(output,c.id+'-response.json'),JSON.stringify(input.restore(answer.value),null,2),{mode:0o600});
  const validate=value=>validateChanges(input.restore(value),evidence,{requireGoalReview:true,checks:programChecks(goalProgramContext(c.records))});
  let report,repaired=false;try{report=validate(answer.value);}catch(error){if(!error.repairHint)throw error;repaired=true;answer=await model(withTrainingGuidance('member-changes',{...request,parts:[{text:JSON.stringify({...input.facts,revision:{draft:answer.value,feedback:error.repairHint}})},...request.parts.slice(1)]}));report=validate(answer.value);await writeFile(join(output,c.id+'-repaired.json'),JSON.stringify(input.restore(answer.value),null,2),{mode:0o600});}
  results.push({id:c.id,rubric:c.rubric,repaired,report});console.log(c.id,'schema validated; semantic review required');
 }catch(e){results.push({id:c.id,error:String(e.message).replace(/AIza[\w-]+/g,'[redacted]').slice(0,300)});console.log(c.id,'failed');}
 await writeFile(join(output,'review.json'),JSON.stringify({version:COACHING_EVIDENCE_VERSION,results},null,2),{mode:0o600});
}
if(results.some(r=>r.error))process.exitCode=1;
