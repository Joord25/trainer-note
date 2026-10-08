import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDiscussionRequest,findTarget,targetFingerprints,validateDecisionProposal,validateDecisionInput,discussionSchema,discussionFacts,overclaim,decisionsKey} from '../coaching-decisions.mjs';
import {programChecks} from '../goal-decision.mjs';

const key='a'.repeat(64);
const report={goalReview:{summary:'s',reason:'r',nextStep:'n',lenses:[{id:'muscles',label:'큰 근육군 참여',status:'recorded',observation:'가슴 6세트 · 등 26세트',recordIds:['r1'],interpretation:'i',question:'q',references:[]}]},directions:[{id:'direction-1',goalAspect:'muscles',kind:'adjust',text:'체스트 프레스를 추가합니다.',reason:'가슴 비중이 낮음',check:'수행 여유 확인',evidenceIds:['e1']}]};

test('discussion request is pinned to one analysis and one item',()=>{
 assert.equal(validateDiscussionRequest(undefined),null);
 const fingerprint='c'.repeat(24);
 assert.deepEqual(validateDiscussionRequest({kind:'lens',id:'muscles',inputKey:key,fingerprint,label:'ignored'}),{kind:'lens',id:'muscles',inputKey:key,fingerprint});
 assert.throws(()=>validateDiscussionRequest({kind:'lens',id:'muscles',inputKey:key}),/분석 항목/,'fingerprint is required');
 assert.throws(()=>validateDiscussionRequest({kind:'lens',id:'muscles',inputKey:'short',fingerprint}));
 assert.throws(()=>validateDiscussionRequest({kind:'other',id:'x',inputKey:key}));
});

test('targets resolve against the saved report only',()=>{
 assert.equal(findTarget(report,{kind:'lens',id:'muscles'}).label,'큰 근육군 참여');
 assert.match(findTarget(report,{kind:'direction',id:'direction-1'}).label,/^큰 근육군 참여 · 체스트/);
 assert.throws(()=>findTarget(report,{kind:'direction',id:'direction-9'}),/찾지 못했어요/);
});

test('a proposal is only shown when the model says one is needed',()=>{
 const target=findTarget(report,{kind:'direction',id:'direction-1'});
 assert.equal(validateDecisionProposal({needed:false,choice:'agree',reason:'',text:'',actionReason:'',check:''},target).proposal,null);
 const adjust=validateDecisionProposal({needed:true,choice:'adjust',reason:'등 중심은 자세 목적이라 유지합니다.',text:'체스트 프레스는 주 1회만 추가합니다.',actionReason:'',check:'확인 결과 어깨 불편이 없으면 유지'},target,{kgs:new Set([20])});
 assert.equal(adjust.proposal.patch.text,'체스트 프레스는 주 1회만 추가합니다.');
 const keep=validateDecisionProposal({needed:true,choice:'agree',reason:'유지합니다.',text:'무시될 문장',actionReason:'',check:''},target);
 assert.equal(keep.proposal.patch,null,'only an adjusted direction carries a patch');
});

test('malformed or over-claiming proposals are dropped with a notice, not an error',()=>{
 const target=findTarget(report,{kind:'direction',id:'direction-1'});
 const bad=validateDecisionProposal({needed:true,choice:'adjust',reason:'코어 비중을 높이면 복부 지방 감소에 좋아요.',text:'플랭크 추가',actionReason:'',check:''},target);
 assert.equal(bad.proposal,null);assert.ok(bad.notice);
 const kg=validateDecisionProposal({needed:true,choice:'adjust',reason:'증량합니다.',text:'체스트 프레스 35kg로 진행',actionReason:'',check:''},target,{kgs:new Set([20,25])});
 assert.equal(kg.proposal,null,'a load not in the records is not proposed');
 assert.equal(validateDecisionProposal({needed:true,choice:'maybe',reason:'x',text:'',actionReason:'',check:''},target).proposal,null);
});

test('saved decisions: patch only for an adjusted direction, principle required when remembered',()=>{
 const fingerprint=findTarget(report,{kind:'direction',id:'direction-1'}).fingerprint;
 const base={inputKey:key,fingerprint,target:{kind:'direction',id:'direction-1'},choice:'adjust',reason:'자세 목적',patch:{text:'주 1회만 추가',reason:'',check:''},remember:false,principle:'',chatId:''};
 assert.equal(validateDecisionInput(base).patch.text,'주 1회만 추가');
 assert.throws(()=>validateDecisionInput({...base,target:{kind:'lens',id:'muscles'}}),/조정한 방향에만/);
 assert.throws(()=>validateDecisionInput({...base,remember:true}),/길이와 형식/);
 assert.throws(()=>validateDecisionInput({...base,reason:''}));
 assert.ok(overclaim('코어 운동으로 뱃살 감소'));
 assert.throws(()=>validateDecisionInput({...base,fingerprint:undefined}),/분석 항목/,'a decision is always pinned to item content');
});

test('discussion schema adds the proposal without loosening the chat schema',()=>{
 const base={type:'OBJECT',properties:{answer:{type:'STRING'}},required:['answer']};
 const s=discussionSchema(base);
 assert.deepEqual(s.required,['answer','decisionProposal']);
 assert.equal(base.required.length,1);
});

test('discussion facts carry the analysis basis without record-id lists',()=>{
 const records=Array.from({length:10},(_,i)=>({id:'r'+i,date:'2026-09-0'+(i%9+1),bodyPart:i<8?'등':'가슴',measurementType:'repetitions',loadType:'weighted',sets:[{kg:20,reps:i<1?3:10}]}));
 const context={window:{from:'2026-08-15',to:'2026-09-11'},completeWeeklyActivityKnown:false,weeks:[],observed:{recordedDays:9,repetitionSets:10,primaryParts:[{part:'등',repetitionSets:8,otherSegments:0,recordIds:['r0']}],cardio:{days:0,segments:0,knownSeconds:null,missingTimeSegments:0,recordIds:[]},lowRepetitionRecords:[{recordId:'r0',setNumbers:[1]}],recordIds:records.map(r=>r.id)}};
 const f=discussionFacts({report,target:findTarget(report,{kind:'lens',id:'muscles'}),goal:{primary:'근비대'},checks:programChecks(context),programContext:context,trainerContext:'',decisions:[],memberNotes:''});
 assert.ok(!JSON.stringify(f).includes('recordIds'));
 assert.equal(f.goalReview.lenses[0].id,'muscles');
});

test('a re-run that puts another card at direction-1 changes its fingerprint (reviewer P1 scenario)',()=>{
 const before=findTarget(report,{kind:'direction',id:'direction-1'});
 const rerun={...report,directions:[{id:'direction-1',goalAspect:'aerobic',kind:'adjust',text:'인터벌 러닝 빈도를 늘립니다.',reason:'',check:'',evidenceIds:[]}]};
 const after=findTarget(rerun,{kind:'direction',id:'direction-1'});
 assert.notEqual(before.fingerprint,after.fingerprint);
 assert.equal(targetFingerprints(report)['direction:direction-1'],before.fingerprint);
 assert.equal(findTarget(report,{kind:'direction',id:'direction-1'}).fingerprint,before.fingerprint,'stable for unchanged content');
});

test('decisionsKey follows each save\'s version token, not a revision counter that restarts after delete',()=>{
 const d=version=>({id:'x'.repeat(40),version,revision:1,choice:'agree',target:{label:'l'},reason:'r',patch:null,updatedAt:0});
 assert.notEqual(decisionsKey([d('v1')]),decisionsKey([d('v2')]),'same id and revision, re-created → different key');
 assert.equal(decisionsKey([d('v1')]),decisionsKey([d('v1')]));
 assert.notEqual(decisionsKey([]),decisionsKey([d('v1')]));
});

test('low-rep status is unchanged from the original rule',()=>{
 const observed=(low,total)=>({window:null,weeks:[],observed:{recordedDays:3,repetitionSets:total,primaryParts:[],cardio:{days:0,segments:0,knownSeconds:null,missingTimeSegments:0,recordIds:[]},lowRepetitionRecords:low?[{recordId:'r1',setNumbers:Array.from({length:low},(_,i)=>i+1)}]:[]}});
 assert.equal(programChecks(observed(2,87)).find(c=>c.id==='resistance').status,'check');
});
