import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programChecks,validateDecisionLenses,GOAL_ASPECTS} from '../goal-decision.mjs';
import {goalProgramContext} from '../goal-program-context.mjs';
const row=(patch={})=>({id:'r',date:'2026-10-09',exerciseName:'런지',bodyPart:'하체',loadType:'weighted',measurementType:'repetitions',sets:[{kg:4,reps:10}],...patch});
test('six checks preserve unknown activity, unilateral observations and actual units',()=>{
 const checks=programChecks(goalProgramContext([row({sets:[{kg:4,reps:8,leftReps:4,rightReps:4}]}),row({id:'distance',measurementType:'weight_distance',sets:[{kg:4,reps:0,distanceMeters:160}]})]));
 assert.deepEqual(checks.map(c=>c.id),Object.keys(GOAL_ASPECTS));
 assert.equal(checks.find(c=>c.id==='aerobic').status,'unknown');
 assert.match(checks.find(c=>c.id==='resistance').observation,/1세트 중 1–5회 1세트/);
 assert.match(checks.find(c=>c.id==='muscles').observation,/1세트 · 1구간/);
 assert.equal(checks.find(c=>c.id==='outcomes').status,'unknown');
});
test('observed cardio time does not become complete time or weekly compliance',()=>{
 const check=programChecks(goalProgramContext([row({bodyPart:'유산소',exerciseName:'트레드밀',measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:120},{kg:null,reps:0}]})])).find(c=>c.id==='aerobic');
 assert.equal(check.status,'check');assert.match(check.observation,/2분 기록 · 시간 미확인 1구간/);
});
test('AI cannot overwrite observed status, facts or source URLs; all six axes and bounded questions required',()=>{
 const checks=programChecks(goalProgramContext([row()]));
 const value=checks.map(c=>({id:c.id,interpretation:'목표와 기록의 연결',question:'',sourceIds:['KSSO2022'],status:'perfect',observation:'invented',references:[{url:'javascript:bad'}]}));
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
 const goalReview={summary:'하체 참여 확인',reason:'목표와 관찰 비교',nextStep:'같은 조건 확인',evidenceIds:[id],sourceIds:[],lenses:checks.map(c=>({id:c.id,interpretation:'목표와 기록 확인',question:'',sourceIds:[]}))};
 const value={goalReview,headline:'기록 확인',findings:[{evidenceId:id,interpretation:'기록된 구성',uncertainty:'범위 제한'}],directions:[{kind:'check',goalAspect:'aerobic',text:'별도 유산소 여부 확인',reason:'현재 범위에는 기록 없음',check:'없으면 가능한 시간에 배치 검토',evidenceIds:[]}]};
 const out=validateChanges(value,evidence,{requireGoalReview:true,checks});assert.match(out.directions[0].scopeObservation,/유산소 기록 없음/);
 assert.throws(()=>validateChanges({...value,directions:[{...value.directions[0],kind:'keep'}]},evidence,{checks}));
 assert.throws(()=>validateChanges({...value,directions:[{...value.directions[0],goalAspect:'muscles'}]},evidence,{checks}));
 assert.throws(()=>validateChanges({...value,directions:[{...value.directions[0],text:'40kg 시행'}]},evidence,{checks}));
});
