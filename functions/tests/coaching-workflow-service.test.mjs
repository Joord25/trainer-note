import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {createCoachingWorkflow} from '../coaching-workflow.mjs';
let app,db,service,calls;const base='trainers/workflow-test/members/member',uid='workflow-test',mid='member';
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'workflow');db=getFirestore(app);});
after(async()=>{await deleteApp(app);});
beforeEach(async()=>{await db.recursiveDelete(db.doc('trainers/workflow-test'));await db.doc(base).set({name:'테스트',goal:'근력',notes:''});await db.doc(base+'/records/a').set({exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:8,reps:12}],revision:1,performedAt:Timestamp.fromDate(new Date('2026-09-01'))});calls=[];service=createCoachingWorkflow({db,sessionNotesFor:async()=>[],paid:async(uid,kind,request)=>{calls.push(kind);const f=JSON.parse(request.parts[0].text);if(kind==='member-changes')return {value:{headline:'단일 기록 확인',findings:[{evidenceId:f.evidence[0].id,interpretation:'변화 판단 전 기준 기록',uncertainty:'추가 기록 필요'}],directions:[{kind:'keep',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'스쿼트 수행 기록 유지',evidenceIds:[f.evidence[0].id]}]}};return {value:{title:'기본 수행 확인',sessions:Array.from({length:f.options.count},(_,i)=>({number:i+1,focus:'동작 확인',progressWhen:'같은 자세로 완료하면 검토',adjustWhen:'피로가 크면 유지',checks:['수행 여유'],items:[{candidateId:f.candidates[0].id,reason:'선택한 방향 유지',recovery:'',segments:[{kg:8,reps:12}]}]}))}};}});});
const options={count:4,frequency:2,minutes:50,equipment:'',directions:[{id:'direction-1',text:'스쿼트 수행 기록 유지'}]};
async function analyzed(){const c=await service.workflowContext(uid,mid);return service.analyzeChanges(uid,mid,{inputKey:c.inputKey});}
test('review is read-only; analysis caches; workflow activation does not mutate member schema',async()=>{const c=await service.workflowContext(uid,mid);assert.equal(c.days,1);assert.equal(c.goal,'근력');assert.equal(calls.length,0);await service.enableCoachingWorkflow(uid,mid);assert.equal((await db.doc(base).get()).data().coachingWorkflow,undefined);assert.equal((await db.doc(base+'/workflowSettings/current').get()).data().version,2);await analyzed();await analyzed();assert.deepEqual(calls,['member-changes']);});
test('selected directions produce exactly four sessions and save without replacing legacy plan',async()=>{const c=await analyzed();await db.doc(base+'/plans/current').set({revision:2,program:[]});const p=await service.generateCycle(uid,mid,{inputKey:c.inputKey,options});assert.equal(p.plan.sessions.length,4);await service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:0});assert.equal((await db.doc(base+'/cyclePlans/current').get()).data().revision,1);assert.equal((await db.doc(base+'/plans/current').get()).data().revision,2);await assert.rejects(service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:0}));await service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:1});assert.equal((await db.doc(base+'/cyclePlanHistory/1').get()).data().revision,1);});
test('record edits invalidate analysis and reject stale plan saves',async()=>{const c=await analyzed(),p=await service.generateCycle(uid,mid,{inputKey:c.inputKey,options});await db.doc(base+'/records/a').update({revision:2,sets:[{kg:10,reps:12}]});const next=await service.workflowContext(uid,mid);assert.notEqual(c.inputKey,next.inputKey);assert.equal(next.report,null);await assert.rejects(service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:0}));assert.deepEqual(await service.analyzeChanges(uid,mid,{inputKey:c.inputKey}),{stale:true});});
test('foreign directions are rejected before a paid plan call',async()=>{const c=await analyzed();await assert.rejects(service.generateCycle(uid,mid,{inputKey:c.inputKey,options:{...options,directions:[{id:'foreign',text:'새 방향'}]}}));assert.equal(calls.length,1);});

test('eight sessions remain separate and repeated generation reuses the paid proposal',async()=>{const c=await analyzed(),req={inputKey:c.inputKey,options:{...options,count:8}};const p=await service.generateCycle(uid,mid,req);assert.equal(p.plan.sessions.length,8);await service.generateCycle(uid,mid,req);assert.deepEqual(calls,['member-changes','cycle-plan']);});
test('workflow mode disables legacy automatic report jobs',async()=>{const {createService}=await import('../service.mjs');let modelCalls=0,queued=0;const legacy=createService({db,model:async()=>{modelCalls++;throw Error('unexpected model');},readSource:async()=>'',enqueue:async()=>{queued++;}});await legacy.enableCoachingWorkflow(uid,mid);await legacy.scheduleReport(uid,mid);const outcome=await legacy.buildReport(uid,mid);assert.equal(outcome.noCharge,true);assert.equal(modelCalls,0);assert.equal(queued,0);});

test('cycle status is read-only, scoped to input and never repeats paid generation',async()=>{const c=await analyzed(),p=await service.generateCycle(uid,mid,{inputKey:c.inputKey,options});const before=calls.length;const status=await service.cycleStatus(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId});assert.equal(status.status,'ready');assert.equal(calls.length,before);assert.deepEqual(await service.cycleStatus(uid,mid,{inputKey:'old',proposalId:p.proposalId}),{stale:true});});


test('one analysis supplies changes and editable direction proposals; reading either stage is free',async()=>{
 const analysis=await analyzed();
 assert.ok(analysis.report.headline);
 assert.ok(analysis.report.findings.length);
 const original=structuredClone(analysis.report.directions);
 assert.ok(original[0].reason);
 assert.ok(original[0].check);
 for(let i=0;i<3;i++){
  const directionScreen=await service.workflowContext(uid,mid);
  assert.deepEqual(directionScreen.report.directions,original);
 }
 assert.deepEqual(calls,['member-changes']);
 const edited=original.map(d=>({id:d.id,text:'같은 조건에서 수행 여유를 확인하고 반복수를 기록'}));
 const plan=await service.generateCycle(uid,mid,{inputKey:analysis.inputKey,options:{...options,directions:edited}});
 assert.deepEqual(plan.plan.options.directions,edited);
 assert.deepEqual((await service.workflowContext(uid,mid)).report.directions,original);
 assert.deepEqual(calls,['member-changes','cycle-plan']);
});
