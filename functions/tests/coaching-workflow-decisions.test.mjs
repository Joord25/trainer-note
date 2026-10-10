// Runs the real coaching workflow (decisions, plan cache, plan save, discussion context) on an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Timestamp} from 'firebase-admin/firestore';
import {createMemoryFirestore} from './helpers/memory-firestore.mjs';
import {createCoachingWorkflow} from '../coaching-workflow.mjs';
import {validateChatRequest} from '../chat.mjs';

const uid='trainer1',mid='member1',base=`trainers/${uid}/members/${mid}`;
const directionsA=[{id:'direction-1',goalAspect:'resistance',kind:'keep',text:'백스쿼트를 최근 기록의 중량·세트 구성으로 유지합니다.',reason:'하체 주요 종목',check:'반복수와 수행 여유 비교',evidenceIds:[]}];
const directionsB=[{id:'direction-1',goalAspect:'aerobic',kind:'adjust',text:'수업 내 유산소 구간을 확인 후 배치합니다.',reason:'유산소 기록 없음',check:'개인 유산소 확인',evidenceIds:[]}];
const report=directions=>({headline:'h',warnings:[],regionalComments:[],findings:[],directions,goalReview:{summary:'s',reason:'r',nextStep:'n',evidenceIds:[],references:[],lenses:[{id:'resistance',label:'저항운동 성격',status:'check',observation:'o',recordIds:['r1','r2'],interpretation:'i',question:'q',references:[]}]}});

async function setup(){
 let clock=Date.parse('2026-10-09T00:00:00Z');
 const now=()=>clock+=1000,db=createMemoryFirestore({now}),calls=[];
 await db.doc(base).set({name:'회원',goal:'근력',notes:''});
 for(const [id,date] of [['r1','2026-09-30'],['r2','2026-10-05']])
  await db.doc(`${base}/records/${id}`).set({exerciseName:'백스쿼트',rawName:'BB sq',bodyPart:'하체',loadType:'weighted',sets:[{kg:60,reps:5},{kg:60,reps:5}],notes:'',status:'confirmed',origin:'manual',revision:1,sourceHash:'',sourceName:'',sourcePage:0,performedAt:Timestamp.fromMillis(Date.parse(date+'T12:00:00Z'))});
 // The plan model returns a valid one-session plan built on the first candidate.
 const paid=async(_uid,kind,request)=>{calls.push(kind);const candidates=JSON.parse(request.parts[0].text).candidates;return {value:{title:'계획',sessions:[{number:1,focus:'f',progressWhen:'p',adjustWhen:'a',checks:['c'],items:[{candidateId:candidates[0].id,reason:'r',recovery:'',segments:[{kg:60,reps:5,leftReps:null,rightReps:null,distanceMeters:null,durationSeconds:null,inclinePercent:null,speedKph:null}]}]}]}};};
 const flow=createCoachingWorkflow({research:async()=>null,db,paid,sessionNotesFor:async()=>[],now});
 const {inputKey}=await flow.workflowContext(uid,mid);
 const publish=async directions=>db.doc(`${base}/changeReviews/${inputKey}`).set({status:'ready',report:report(directions),updatedAt:Timestamp.fromMillis(now())});
 await publish(directionsA);
 const fp=async key=>(await flow.workflowContext(uid,mid)).targetFingerprints[key];
 const options={count:1,frequency:2,minutes:50,equipment:'',directions:[{id:'direction-1',text:directionsA[0].text}]};
 return {db,flow,inputKey,publish,fp,options,calls};
}
const decide=(flow,inputKey,fingerprint,choice)=>flow.saveCoachingDecision(uid,mid,{inputKey,fingerprint,target:{kind:'direction',id:'direction-1'},choice,reason:'트레이너 판단',patch:null,remember:false,principle:'',chatId:''});

test('keep → plan → undo → hold: the old plan is neither reused nor saved',async()=>{
 const {db,flow,inputKey,fp,options,calls}=await setup();
 const first=await decide(flow,inputKey,await fp('direction:direction-1'),'agree');
 const firstPlan=await flow.generateCycle(uid,mid,{inputKey,options});
 assert.equal(firstPlan.status,'ready');assert.equal(calls.filter(k=>k==='cycle-plan').length,1);
 await flow.removeCoachingDecision(uid,mid,{id:first.decisions[0].id});
 const second=await decide(flow,inputKey,await fp('direction:direction-1'),'hold');
 assert.equal(second.decisions[0].id,first.decisions[0].id,'same item → same decision id');
 assert.notEqual(second.decisions[0].version,first.decisions[0].version,'re-created decision gets a new version');
 assert.notEqual(second.decisionsKey,first.decisionsKey);
 const secondPlan=await flow.generateCycle(uid,mid,{inputKey,options});
 assert.notEqual(secondPlan.proposalId,firstPlan.proposalId,'plan cache is keyed to decisions');
 assert.equal(calls.filter(k=>k==='cycle-plan').length,2,'a new plan was generated');
 await assert.rejects(flow.saveCycle(uid,mid,{inputKey,proposalId:firstPlan.proposalId,revision:0}),/결정이 계획을 만든 뒤 바뀌었어요/);
 assert.equal(db.dump(`${base}/cyclePlans`).length,0,'nothing was saved');
 await flow.saveCycle(uid,mid,{inputKey,proposalId:secondPlan.proposalId,revision:0});
 assert.equal(db.dump(`${base}/cyclePlans`).length,1,'the current plan saves');
});

test('editing a decision (same id) also invalidates the plan',async()=>{
 const {flow,inputKey,fp,options}=await setup();
 await decide(flow,inputKey,await fp('direction:direction-1'),'agree');
 const plan=await flow.generateCycle(uid,mid,{inputKey,options});
 await decide(flow,inputKey,await fp('direction:direction-1'),'hold');
 await assert.rejects(flow.saveCycle(uid,mid,{inputKey,proposalId:plan.proposalId,revision:0}),/결정이 계획을 만든 뒤 바뀌었어요/);
});

test('a re-run that puts another card at direction-1 blocks old discussions and old proposals',async()=>{
 const {flow,inputKey,publish,fp}=await setup();
 const oldFp=await fp('direction:direction-1');
 const ctx=await flow.discussionContext(uid,mid,{kind:'direction',id:'direction-1',inputKey,fingerprint:oldFp});
 assert.match(ctx.target.label,/백스쿼트/);
 await publish(directionsB);// same inputKey, different card at direction-1
 assert.notEqual(await fp('direction:direction-1'),oldFp);
 await assert.rejects(flow.discussionContext(uid,mid,{kind:'direction',id:'direction-1',inputKey,fingerprint:oldFp}),/대상 항목이 바뀌었어요/,'follow-up in the old chat');
 await assert.rejects(decide(flow,inputKey,oldFp,'adjust'),/대상 항목이 바뀌었어요/,'saving the old proposal');
 const fresh=await flow.discussionContext(uid,mid,{kind:'direction',id:'direction-1',inputKey,fingerprint:await fp('direction:direction-1')});
 assert.match(fresh.target.label,/유산소/);
});

test('the assistant rejects a discussion request without a fingerprint',()=>{
 const req={requestId:'x'.repeat(20),question:'왜?',answerMode:'quick'};
 assert.throws(()=>validateChatRequest({...req,discussion:{kind:'direction',id:'direction-1',inputKey:'a'.repeat(64)}}),/분석 항목/);
 assert.equal(validateChatRequest({...req,discussion:{kind:'direction',id:'direction-1',inputKey:'a'.repeat(64),fingerprint:'b'.repeat(24)}}).discussion.fingerprint,'b'.repeat(24));
});

test('undo can also remove the principle saved for other members',async()=>{
 const {db,flow,inputKey,fp}=await setup();
 const saved=await flow.saveCoachingDecision(uid,mid,{inputKey,fingerprint:await fp('direction:direction-1'),target:{kind:'direction',id:'direction-1'},choice:'agree',reason:'r',patch:null,remember:true,principle:'자세 목적의 등 위주 구성은 유지',chatId:''});
 assert.equal(db.dump(`trainers/${uid}/trainingPrinciples`).length,1);
 await flow.removeCoachingDecision(uid,mid,{id:saved.decisions[0].id,removePrinciple:true});
 assert.equal(db.dump(`trainers/${uid}/trainingPrinciples`).length,0);
 assert.equal(db.dump(`${base}/coachingDecisions`).length,0);
});
