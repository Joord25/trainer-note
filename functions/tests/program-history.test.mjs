import {test} from 'node:test';
import assert from 'node:assert/strict';
import {programHistory} from '../program-history.mjs';
const row=(id,date,exerciseName,patch={})=>({id,date,exerciseName,bodyPart:'가슴',loadType:'bodyweight',sets:[{kg:null,reps:10}],sourceHash:'file',sourcePage:1,sourceName:'일지',...patch});
test('original program order follows imported rows, not document IDs; compound order is retained',()=>{
 const rows=[row('a','2026-09-01','푸시업'),row('z','2026-09-01','인터벌 러닝',{bodyPart:'유산소',measurementType:'duration',sets:[{durationSeconds:60}]}),row('b','2026-09-01','스쿼트')];
 const history=programHistory(rows,[{rows:[{id:'z'},{id:'b',compound:{rawName:'복합',index:1,total:2}},{id:'a',compound:{rawName:'복합',index:2,total:2}}]}]);
 const session=history.sessions[0];assert.deepEqual(session.blocks[0].exercises.map(r=>r.recordId),['z','b','a']);assert.equal(session.blocks[0].orderKnown,true);assert.equal(session.strengthSets,2);assert.equal(session.cardioSegments,1);assert.equal(session.blocks[0].exercises[1].compound.index,1);
});
test('same-day sources stay separate; manual or missing source order is not invented',()=>{
 const history=programHistory([row('a','2026-09-01','푸시업'),row('b','2026-09-01','로우',{sourceHash:'another'}),row('c','2026-09-02','직접 추가',{sourceHash:'',sourcePage:0})],[{rows:[{id:'a'},{id:'b'}]}]);
 assert.equal(history.sessions.length,2);assert.equal(history.sessions[0].blocks.length,2);assert.equal(history.sessions[1].blocks[0].orderKnown,false);
});
test('recurring combinations count sessions rather than sets and retain all session sizes',()=>{
 const rows=['2026-09-01','2026-09-03'].flatMap((date,n)=>[row('a'+n,date,'푸시업'),row('b'+n,date,'스쿼트'),row('c'+n,date,'푸시업')]);
 const history=programHistory(rows);assert.equal(history.patterns.sessionCount,2);assert.deepEqual(history.patterns.exerciseCountRange,[3,3]);assert.equal(history.patterns.recurringPairs[0].sessions,2);
});

test('lesson facts omit unconfirmed assessment drafts but retain trainer intent and confirmed methods',async()=>{
 const {lessonFacts}=await import('../lesson-planning.mjs');
 const draft={title:'not approved test'},state={rows:[],candidates:[],visuals:[],goal:{assessment:{confirmed:false,description:'내 평가 방법',draft}},memory:{memberDecisions:[{reason:'기준 조정',goal:{assessmentConfirmed:false,assessment:draft}}]}};
 const facts=lessonFacts(state);assert.equal(facts.goal.assessment.description,'내 평가 방법');assert.equal(facts.goal.assessment.draft,undefined);assert.equal(facts.memory.memberDecisions[0].goal.assessment,null);assert.deepEqual(state.goal.assessment.draft,draft);
 state.goal.assessment.confirmed=true;state.memory.memberDecisions[0].goal.assessmentConfirmed=true;
 const confirmed=lessonFacts(state);assert.deepEqual(confirmed.goal.assessment.draft,draft);assert.deepEqual(confirmed.memory.memberDecisions[0].goal.assessment,draft);
});

test('lesson explanations cannot turn total reps into an unsupported performance claim',async()=>{
 const {validateLesson}=await import('../lesson-planning.mjs');const candidate={id:'push',recordId:'push',segments:[{kg:null,reps:8},{kg:null,reps:8}],evidence:[]};
 const draft=validateLesson({title:'다음 수업',before:[],programSummary:'기존 구성 유지',programDates:[],checks:[],items:[{candidateId:'push',action:'review',goal:'푸시업 20회 목표',reason:'현재 16회 수행에서 증가',guide:'같은 가동범위 확인',check:'중단 이유 기록',evidenceIds:[]}]},{candidates:[candidate],visuals:[],history:{sessions:[]}});
 assert.equal(draft.items[0].reason,'');assert.deepEqual(draft.items[0].segments,candidate.segments);assert.equal(draft.items[0].goal,'푸시업 20회 목표');
});
