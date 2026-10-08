import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {createCoachingWorkflow} from '../coaching-workflow.mjs';
let app,db,service,calls,inputs;const base='trainers/workflow-test/members/member',uid='workflow-test',mid='member';
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'workflow');db=getFirestore(app);});
after(async()=>{await deleteApp(app);});
beforeEach(async()=>{await db.recursiveDelete(db.doc('trainers/workflow-test'));await db.doc(base).set({name:'테스트',goal:'근력',notes:''});await db.doc(base+'/records/a').set({exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:8,reps:12}],revision:1,performedAt:Timestamp.fromDate(new Date('2026-09-01'))});calls=[];inputs=[];service=createCoachingWorkflow({db,sessionNotesFor:async()=>[],paid:async(uid,kind,request)=>{calls.push(kind);const f=JSON.parse(request.parts[0].text);inputs.push(f);if(kind==='member-changes')return {value:{goalReview:{lenses:f.programChecks.map(c=>({id:c.id,interpretation:'목표와 기록을 함께 확인합니다.',question:'',sourceIds:[]})),summary:'하체 스쿼트 기록 확인',reason:'회원 목표와 수행 기록을 함께 검토합니다.',nextStep:'같은 조건에서 수행 여유를 비교합니다.',evidenceIds:[f.evidence[0].id],sourceIds:[]},headline:'단일 기록 확인',findings:[{evidenceId:f.evidence[0].id,interpretation:'변화 판단 전 기준 기록',uncertainty:'추가 기록 필요'}],directions:[{goalAspect:'resistance',kind:'keep',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'스쿼트 수행 기록 유지',evidenceIds:[f.evidence[0].id]}]}};return {value:{title:'기본 수행 확인',sessions:Array.from({length:f.options.count},(_,i)=>({number:i+1,focus:'동작 확인',progressWhen:'같은 자세로 완료하면 검토',adjustWhen:'피로가 크면 유지',checks:['수행 여유'],items:[{candidateId:f.candidates[0].id,reason:'선택한 방향 유지',recovery:'',segments:[{kg:8,reps:12}]}]}))}};}});});
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

test('reopening restores generated proposal and settings without another paid call',async()=>{
 const c=await analyzed(),custom={...options,count:8,frequency:3,minutes:60,equipment:'덤벨'};
 const p=await service.generateCycle(uid,mid,{inputKey:c.inputKey,options:custom});
 const restored=await service.workflowContext(uid,mid);
 assert.deepEqual(restored.report,c.report);
 assert.equal(restored.latestProposal.id,p.proposalId);
 assert.deepEqual(restored.latestProposal.plan.options,custom);
 assert.equal(restored.savedPlan,null);
 assert.deepEqual(calls,['member-changes','cycle-plan']);
 await service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:0});
 const saved=await service.workflowContext(uid,mid);
 assert.equal(saved.latestProposal,null);
 assert.deepEqual(saved.savedPlan.plan.options,custom);
 await db.doc(base+'/records/a').update({revision:2,sets:[{kg:10,reps:12}]});
 const changed=await service.workflowContext(uid,mid);
 assert.equal(changed.latestProposal,null);
 assert.equal(changed.report,null);
 assert.deepEqual(calls,['member-changes','cycle-plan']);
});

test('trainer edits save without AI, preserve source and options, and survive reopen',async()=>{
 const c=await analyzed(),p=await service.generateCycle(uid,mid,{inputKey:c.inputKey,options});
 const edited=structuredClone(p.plan);edited.sessions[0].items[0].segments=[{kg:10,reps:8},{kg:10,reps:8}];
 edited.sessions[0].items[0].reference='forged reference';edited.options.minutes=999;
 const result=await service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:0,editedPlan:edited});
 assert.equal(result.plan.trainerEdited,true);assert.equal(result.plan.options.minutes,50);
 assert.equal(result.plan.sessions[0].items[0].reference,p.plan.sessions[0].items[0].reference);
 assert.deepEqual(result.plan.sessions[0].items[0].segments,[{kg:10,reps:8},{kg:10,reps:8}]);
 const reopened=await service.workflowContext(uid,mid);assert.deepEqual(reopened.savedPlan.plan,result.plan);assert.equal(reopened.latestProposal,null);
 assert.deepEqual(calls,['member-changes','cycle-plan']);
 edited.sessions[0].items[0].segments=[{kg:-2,reps:8}];
 await assert.rejects(service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:1,editedPlan:edited}));
 edited.sessions[0].items[0].id='foreign';
 await assert.rejects(service.saveCycle(uid,mid,{inputKey:c.inputKey,proposalId:p.proposalId,revision:1,editedPlan:edited}));
 assert.equal((await service.workflowContext(uid,mid)).savedPlan.revision,1);
 assert.deepEqual(calls,['member-changes','cycle-plan']);
});

test('explicit member-change reanalysis bypasses cache while reopening stays free',async()=>{
 const first=await analyzed();
 await service.analyzeChanges(uid,mid,{inputKey:first.inputKey});
 assert.deepEqual(calls,['member-changes']);
 const refreshed=await service.analyzeChanges(uid,mid,{inputKey:first.inputKey,retry:true});
 assert.equal(refreshed.status,'ready');assert.ok(refreshed.report);
 assert.deepEqual(calls,['member-changes','member-changes']);
 await service.workflowContext(uid,mid);
 await service.analyzeChanges(uid,mid,{inputKey:first.inputKey});
 assert.equal(calls.length,2);
});


test('goal and observed composition reach both workflow requests; goal edits invalidate cached interpretation',async()=>{
 await db.doc(base).update({goal:'다이어트',notes:'PT 밖 운동은 아직 확인하지 않음'});
 const c=await analyzed();
 assert.equal(inputs[0].goal.primary,'다이어트');
 assert.equal(inputs[0].memberNotes,'PT 밖 운동은 아직 확인하지 않음');
 assert.equal(inputs[0].programContext.completeWeeklyActivityKnown,false);
 assert.equal(inputs[0].programContext.observed.cardio.knownSeconds,null);
 assert.equal(inputs[0].programContext.observed.primaryParts[0].part,'하체');
 await service.generateCycle(uid,mid,{inputKey:c.inputKey,options});
 assert.deepEqual(inputs[1].programContext,inputs[0].programContext);
 await db.doc(base).update({goal:'기초체력강화'});
 const next=await service.workflowContext(uid,mid);assert.notEqual(next.inputKey,c.inputKey);assert.equal(next.report,null);
 assert.deepEqual(await service.analyzeChanges(uid,mid,{inputKey:c.inputKey}),{stale:true});
});

test('trainer context saves explicitly, isolates members, invalidates reports and reaches reanalysis and plan',async()=>{
 const before=await analyzed(),oldPlan=await service.generateCycle(uid,mid,{inputKey:before.inputKey,options});
 const next=await service.saveCoachingContext(uid,mid,{text:'10월 9일 확인: 저반복은 의도한 근력 훈련',revision:0});
 assert.notEqual(next.inputKey,before.inputKey);assert.equal(next.report,null);assert.equal(calls.length,2);
 assert.equal(next.trainerContext.revision,1);assert.match(next.trainerContext.text,/의도한/);
 await assert.rejects(service.saveCoachingContext(uid,mid,{text:'stale overwrite',revision:0}));
 await assert.rejects(service.saveCoachingContext(uid,'other-member',{text:'foreign',revision:0}));
 await assert.rejects(service.saveCoachingContext(uid,mid,{text:'x'.repeat(2001),revision:1}));
 await assert.rejects(service.saveCycle(uid,mid,{inputKey:before.inputKey,proposalId:oldPlan.proposalId,revision:0}));
 const reviewed=await service.analyzeChanges(uid,mid,{inputKey:next.inputKey});
 assert.equal(inputs.at(-1).trainerContext,next.trainerContext.text);assert.equal(reviewed.report.goalReview.lenses.length,6);
 await service.generateCycle(uid,mid,{inputKey:reviewed.inputKey,options});assert.equal(inputs.at(-1).trainerContext,next.trainerContext.text);
 const cleared=await service.saveCoachingContext(uid,mid,{text:'',revision:1});assert.equal(cleared.trainerContext.text,'');assert.equal(cleared.trainerContext.revision,2);
});
