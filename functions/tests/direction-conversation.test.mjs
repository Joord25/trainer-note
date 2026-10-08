import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {createMemoryFirestore} from './helpers/memory-firestore.mjs';
import {createCoachingWorkflow} from '../coaching-workflow.mjs';
import {validateDirectionReply} from '../direction-conversation.mjs';
import {withTrainingGuidance} from '../training-guidance.mjs';
const base='trainers/t/members/m';
async function setup({answer,onCall}={}){
 const db=createMemoryFirestore(),calls=[];
 await db.doc(base).set({name:'테스트',goal:'근력'});
 await db.doc(base+'/records/r').set({exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:20,reps:10}],performedAt:Timestamp.fromDate(new Date('2026-09-01'))});
 const flow=createCoachingWorkflow({db,sessionNotesFor:async()=>[],paid:async(_uid,kind,req)=>{const data=JSON.parse(req.parts[0].text);calls.push({kind,data});await onCall?.({db,data});return {value:kind==='direction-discussion'?(answer??{answer:'의도는 이해했어요. 확인된 기록과 목표를 함께 비교해봅시다.',sourceIds:[],directions:data.mode==='draft'?['스쿼트를 최근 조건으로 진행하고 수행 여유를 확인합니다.']:[]}):{title:'수업 계획',sessions:[{number:1,focus:'기술 확인',checks:[],progressWhen:'수행 여유 확인 후',adjustWhen:'불편 시',items:[{candidateId:'r',segments:[{kg:20,reps:10}],reason:'기록 유지',recovery:''}]}]}};}});
 const {inputKey}=await flow.workflowContext('t','m');
 const report={headline:'관찰',findings:[],directions:[{id:'direction-1',text:'스쿼트 유지',evidenceIds:[],kind:'keep'}],goalReview:{summary:'하체 중심',reason:'기록 확인',nextStep:'의도 확인',references:[],lenses:[]}};
 await db.doc(base+'/changeReviews/'+inputKey).set({status:'ready',report});
 const c=await flow.workflowContext('t','m'),scope={inputKey,discussionKey:c.discussionKey},directions=[{id:'direction-1',text:'스쿼트 유지'}];
 const req={...scope,revision:0,requestId:'request-1234567890',mode:'discuss',question:'기술 연습 의도였어요',directions};
 return {db,flow,c,scope,req,directions,calls,report};
}
test('discussion is persisted, idempotent and does not change report, context or selected directions',async()=>{
 const {flow,req,c,calls}=await setup();const a=await flow.converseDirection('t','m',req),b=await flow.converseDirection('t','m',req);
 assert.equal(a.messages.length,1);assert.deepEqual(a,b);assert.equal(calls.length,1);
 const reopened=await flow.directionConversation('t','m',req);assert.deepEqual(a,reopened);
 const next=await flow.workflowContext('t','m');assert.equal(next.inputKey,c.inputKey);assert.deepEqual(next.report,c.report);assert.equal(next.directionSelection,null);assert.equal(next.decisions.length,0);
 assert.ok(calls[0].data.analysis.programChecks);assert.ok(calls[0].data.analysis.evidence);assert.deepEqual(calls[0].data.report,c.report);
});
test('whole report pin rejects replaced analysis and never pays for stale follow-up',async()=>{
 const {db,flow,scope,req,calls,report}=await setup();await db.doc(base+'/changeReviews/'+scope.inputKey).set({status:'ready',report:{...report,headline:'다른 판단'}});
 await assert.rejects(flow.converseDirection('t','m',req),/분석이 바뀌었어요/);assert.equal(calls.length,0);
 await assert.rejects(flow.directionConversation('t','m',req),/분석이 바뀌었어요/);
 await assert.rejects(flow.converseDirection('t','other',req),/회원/);
});
test('draft waits for explicit selection; versions block old plans and preserve manual additions',async()=>{
 const {flow,req,scope,directions}=await setup();const draft=await flow.converseDirection('t','m',{...req,mode:'draft'});
 assert.equal((await flow.workflowContext('t','m')).directionSelection,null);
 const picked=await flow.saveDirectionSelection('t','m',{...scope,directions:draft.messages[0].directions,version:''});
 assert.equal((await flow.workflowContext('t','m')).inputKey,scope.inputKey);
 const options={count:1,frequency:2,minutes:50,equipment:'',directions:picked.directions};const plan=await flow.generateCycle('t','m',{...scope,options});assert.equal(plan.status,'ready');
 await assert.rejects(flow.saveDirectionSelection('t','m',{...scope,directions,version:''}),/바뀌었어요/);
 const changed=await flow.saveDirectionSelection('t','m',{...scope,directions,version:picked.version});assert.notEqual(changed.version,picked.version);
 await assert.rejects(flow.saveCycle('t','m',{...scope,proposalId:plan.proposalId,revision:0}),/수업 방향/);
 await assert.rejects(flow.generateCycle('t','m',{...scope,options}),/저장한 방향/);
 const current=await flow.generateCycle('t','m',{...scope,options:{...options,directions}});await flow.saveCycle('t','m',{...scope,proposalId:current.proposalId,revision:0});
 assert.deepEqual((await flow.workflowContext('t','m')).savedPlan.plan.options.directions,directions);
});
test('record changes during the model call discard the reply',async()=>{
 const {flow,req,db}=await setup({onCall:async({db})=>db.doc(base+'/records/r').update({sets:[{kg:22,reps:8}]})});
 await assert.rejects(flow.converseDirection('t','m',req),/분석이 바뀌었어요/);
 const saved=(await db.doc(base+'/directionConversations/'+req.discussionKey).get()).data();assert.deepEqual(saved.messages,[]);assert.equal(saved.pending,null);
});
test('concurrent/outdated revisions cannot replace prior dialogue',async()=>{
 const {flow,req}=await setup();await flow.converseDirection('t','m',req);
 await assert.rejects(flow.converseDirection('t','m',{...req,requestId:'another-1234567890'}),/다른 화면/);
 await assert.rejects(flow.converseDirection('t','m',{...req,question:'다른 내용'}),/같은 요청/);
 const next=await flow.converseDirection('t','m',{...req,revision:1,requestId:'another-1234567890'});assert.equal(next.messages.length,2);
});
test('invented sources, unsupported prescription and empty drafts are rejected',()=>{
 const options={mode:'draft',kgs:new Set([20])},base={answer:'답변',sourceIds:[],directions:['최근 조건을 유지합니다.']};
 assert.throws(()=>validateDirectionReply({...base,sourceIds:['invented']},options));
 assert.throws(()=>validateDirectionReply({...base,directions:['40kg로 증량합니다.']},options));
 assert.throws(()=>validateDirectionReply({...base,directions:[]},options));
 assert.equal(validateDirectionReply(base,options).directions.length,1);
});
test('discussion receives the same curated guidance while ordinary chat remains question-specific',()=>{
 assert.equal(withTrainingGuidance('direction-discussion',{system:''}).system,withTrainingGuidance('member-changes',{system:''}).system);
 assert.equal(withTrainingGuidance('assistant-chat',{system:'chat'}).system,'chat');
});


test('failed reply leaves readable history and permits retry with the same request',async()=>{
 let first=true;const {flow,req}=await setup({onCall:async()=>{if(first){first=false;throw Error('temporary model failure');}}});
 await assert.rejects(flow.converseDirection('t','m',req),/temporary/);
 const failed=await flow.directionConversation('t','m',req);assert.equal(failed.processing,false);assert.equal(failed.error,undefined);assert.ok(failed.notice);assert.equal(failed.messages.length,0);
 const retry=await flow.converseDirection('t','m',req);assert.equal(retry.messages.length,1);assert.equal(retry.notice,'');
});
