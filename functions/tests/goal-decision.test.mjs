import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programChecks,validateDecisionLenses,GOAL_ASPECTS} from '../goal-decision.mjs';
import {goalProgramContext} from '../goal-program-context.mjs';
const row=(patch={})=>({id:'r',date:'2026-10-09',exerciseName:'런지',bodyPart:'하체',loadType:'weighted',measurementType:'repetitions',sets:[{kg:4,reps:10}],...patch});
test('six checks preserve unknown activity, unilateral observations and actual units',()=>{
 const checks=programChecks(goalProgramContext([row({sets:[{kg:4,reps:8,leftReps:4,rightReps:4}]}),row({id:'distance',measurementType:'weight_distance',sets:[{kg:4,reps:0,distanceMeters:160}]})]));
 assert.deepEqual(checks.map(c=>c.id),Object.keys(GOAL_ASPECTS));
 assert.equal(checks.find(c=>c.id==='aerobic').status,'unknown');
 assert.match(checks.find(c=>c.id==='resistance').observation,/횟수 기록 1세트 · 중량 기록 1세트/);
 assert.match(checks.find(c=>c.id==='resistance').detail,/1–5회 1세트/);
 assert.deepEqual(new Set(checks.find(c=>c.id==='resistance').recordIds),new Set(['r','distance']));
 assert.match(checks.find(c=>c.id==='muscles').observation,/1세트 · 1구간/);
 assert.equal(checks.find(c=>c.id==='outcomes').status,'unknown');
});
test('observed cardio time does not become complete time or weekly compliance',()=>{
 const check=programChecks(goalProgramContext([row({bodyPart:'유산소',exerciseName:'트레드밀',measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:120},{kg:null,reps:0}]})])).find(c=>c.id==='aerobic');
 assert.equal(check.status,'check');assert.match(check.observation,/2분 기록 · 시간 미확인 1구간/);
});
test('AI cannot overwrite observed status, facts or source URLs; all six axes and bounded questions required',()=>{
 const checks=programChecks(goalProgramContext([row()]));
 const value=checks.map(c=>({id:c.id,interpretation:'목표와 기록의 연결',comparison:c.id==='resistance'?'NASM 기준은 최대근력 1–5회, 근비대 6–12회, 근지구력 12–20회와 파워의 폭발적 속도를 함께 봐요.':c.id==='aerobic'?'WHO 주 150–300분 기준은 전체 활동과 강도를 확인해 비교해요.':'대한비만학회 기준과 기록 범위를 구분해요.',recommendation:'기록된 조건에서 수행 여유를 비교하고 조절해요.',question:'',sourceIds:[c.id==='resistance'?'NASM-OPT':c.id==='aerobic'?'WHO2020':'KSSO2022'],status:'perfect',observation:'invented',references:[{url:'javascript:bad'}]}));
 const out=validateDecisionLenses(value,checks);
 assert.equal(out[1].status,'unknown');assert.equal(out[1].observation,checks[1].observation);assert.equal(out[0].references[0].url,'https://pmc.ncbi.nlm.nih.gov/articles/PMC10088549/');
 assert.throws(()=>validateDecisionLenses(value.slice(1),checks));
 assert.throws(()=>validateDecisionLenses(value.map((v,i)=>i===1?value[0]:v),checks));
 assert.throws(()=>validateDecisionLenses(value.map(v=>({...v,question:'이미 확인한 내용인가요?'})),checks));
 assert.throws(()=>validateDecisionLenses(value.map(v=>({...v,sourceIds:['invented']})),checks));
});

import {changeEvidence,validateChanges} from '../coaching-workflow.mjs';
test('missing-activity questions use server scope; keep or invented-load proposals still require personal evidence',()=>{
 const records=[row()],evidence=changeEvidence(records),checks=programChecks(goalProgramContext(records)),id=evidence.find(e=>e.kind==='composition').id;
 const goalReview={summary:'하체 참여 확인',reason:'NASM 기준과 관찰 비교',nextStep:'같은 조건 확인',evidenceIds:[id],sourceIds:['NASM-OPT'],lenses:checks.map(c=>({id:c.id,interpretation:'목표와 기록 확인',comparison:c.id==='resistance'?'NASM 기준은 최대근력 1–5회, 근비대 6–12회, 근지구력 12–20회와 파워의 폭발적 속도를 함께 봐요.':c.id==='aerobic'?'WHO 주 150–300분 기준은 전체 활동과 강도를 확인해 비교해요.':'대한비만학회 기준과 기록 범위를 구분해요.',recommendation:'기록된 조건에서 수행 여유를 비교하고 조절해요.',question:'',sourceIds:c.id==='resistance'?['NASM-OPT']:c.id==='aerobic'?['WHO2020']:[]} ))};
 const value={goalReview,headline:'기록 확인',findings:[{evidenceId:id,interpretation:'기록된 구성',uncertainty:'범위 제한'}],directions:[{kind:'check',goalAspect:'aerobic',text:'별도 유산소 여부 확인',reason:'현재 범위에는 기록 없음',check:'없으면 가능한 시간에 배치 검토',evidenceIds:[]}]};
 const out=validateChanges(value,evidence,{requireGoalReview:true,checks});assert.match(out.directions[0].scopeObservation,/유산소 기록 없음/);
 assert.throws(()=>validateChanges({...value,directions:[{...value.directions[0],kind:'keep'}]},evidence,{checks}));
 assert.throws(()=>validateChanges({...value,directions:[{...value.directions[0],goalAspect:'muscles'}]},evidence,{checks}));
 assert.throws(()=>validateChanges({...value,directions:[{...value.directions[0],text:'40kg 시행'}]},evidence,{checks}));
});

test('detailed lenses retain comparison and action, require the relevant source, and reject empty or oversized explanations',()=>{
 const checks=programChecks(goalProgramContext([row()]));
 const value=checks.map(c=>({id:c.id,interpretation:'스쿼트는 10회로 기록됐어요.',comparison:c.id==='resistance'?'NASM 최대근력 1–5회, 근비대 6–12회, 근지구력 12–20회 및 파워의 폭발적 속도와 비교하며 상대 부하를 확인해요.':c.id==='aerobic'?'WHO 주 150–300분 기준과 기록 범위를 비교해요.':'현재 기록과 목표를 비교해요.',recommendation:'기록된 중량에서 10회를 유지하며 마지막 반복의 수행 여유를 기록해요.',question:'',sourceIds:c.id==='resistance'?['NASM-OPT']:c.id==='aerobic'?['WHO2020']:[]}));
 const result=validateDecisionLenses(value,checks);
 assert.equal(result[2].comparison,value[2].comparison);
 assert.equal(result[2].recommendation,value[2].recommendation);
 for(const field of ['comparison','recommendation']){
  assert.throws(()=>validateDecisionLenses(value.map(v=>({...v,[field]:''})),checks));
  assert.throws(()=>validateDecisionLenses(value.map(v=>({...v,[field]:'x'.repeat(751)})),checks));
 }
 for(const id of ['resistance','aerobic'])assert.throws(()=>validateDecisionLenses(value.map(v=>v.id===id?{...v,sourceIds:[]}:v),checks));
});

test('a source link alone cannot pass as a criterion-based explanation',()=>{
 const checks=programChecks(goalProgramContext([row()]));
 const value=checks.map(c=>({id:c.id,interpretation:'현재 기록을 비교해요.',comparison:c.id==='resistance'?'NASM 최대근력 1–5회, 근비대 6–12회, 근지구력 12–20회와 파워의 폭발적 속도를 구분해요.':c.id==='aerobic'?'WHO 주 150–300분 기준과 기록 범위를 비교해요.':'현재 기록 범위를 비교해요.',recommendation:'스쿼트의 기록된 10회를 유지하고 수행 여유를 기록해요.',question:'',sourceIds:c.id==='resistance'?['NASM-OPT']:c.id==='aerobic'?['WHO2020']:[]}));
 assert.doesNotThrow(()=>validateDecisionLenses(value,checks));
 for(const id of ['resistance','aerobic'])assert.throws(()=>validateDecisionLenses(value.map(v=>v.id===id?{...v,comparison:'일반적인 범위 내에서 안정적으로 수행되고 있어요.'}:v),checks));
 assert.throws(()=>validateDecisionLenses(value.map(v=>v.id==='muscles'?{...v,sourceIds:['ACSM2026']}:v),checks));
});
