import {test} from 'node:test';
import assert from 'node:assert/strict';
import {evaluateJudgment,judgmentResponseSchema,validateJudgments,judgmentDate,selectCases} from '../judgment.mjs';
const context=evaluateJudgment({records:[],goal:'근력'});
const output=()=>Object.fromEntries(context.cards.map(c=>[c.id,{cardId:c.id,version:c.version,status:c.status,observation:'정보 부족',interpretation:'조건 확인 필요',question:'',action:'비교 조건 확인',evidenceIds:[],caseIds:[]} ]));
test('withheld judgments bind status and reference scope in the generation schema',()=>{
 const schema=judgmentResponseSchema(context);assert.deepEqual(schema.required,context.cards.map(c=>c.id));
 for(const c of context.cards){const p=schema.properties[c.id].properties;assert.deepEqual(p.status.enum,['needs_information']);assert.deepEqual(p.cardId.enum,[c.id]);assert.deepEqual(p.version.enum,[c.version]);assert.deepEqual(p.evidenceIds.enum,['none']);assert.deepEqual(p.caseIds.enum,['none']);}
 const mixed={...context,cards:context.cards.map((c,i)=>i===0?{...c,status:'candidate',evidenceIds:['r1']}:c),cases:[{id:'case1'}]};const m=judgmentResponseSchema(mixed);assert.deepEqual(m.properties.comparison.properties.evidenceIds.items.enum,['r1']);assert.deepEqual(m.properties.comparison.properties.status.enum,['candidate']);assert.deepEqual(m.properties.progress.properties.status.enum,['needs_information']);assert.deepEqual(m.properties.progress.properties.caseIds.items.enum,['case1']);
});
test('keyed Gemini response becomes stable UI array without relaxing validation',()=>{
 assert.deepEqual(validateJudgments(output(),context).map(c=>c.cardId),context.cards.map(c=>c.id));
 const sentinel=output();for(const v of Object.values(sentinel)){v.evidenceIds='none';v.caseIds='none';}assert.ok(validateJudgments(sentinel,context).every(v=>v.evidenceIds.length===0&&v.caseIds.length===0));
 const promoted=output();promoted.plateau.status='not_applicable';assert.throws(()=>validateJudgments(promoted,context));
 const invented=output();invented.progress.evidenceIds=['unconfirmed-record'];assert.throws(()=>validateJudgments(invented,context));
 const crossed=output();[crossed.progress,crossed.plateau]=[crossed.plateau,crossed.progress];assert.throws(()=>validateJudgments(crossed,context));
 const omitted=output();delete omitted.plan;assert.throws(()=>validateJudgments(omitted,context));
 const extra=output();extra.injected=extra.plan;assert.throws(()=>validateJudgments(extra,context));
});

test('Korean calendar date retains morning outcomes without admitting future ones',()=>{
 const now=Date.parse('2026-09-10T23:00:00Z');assert.equal(judgmentDate(now),'2026-09-11');
 const decisions=[{id:'d',createdAt:now-1000,snapshot:{goal:'근력',records:[]}}];
 const outcomes=[{id:'today',decisionId:'d',createdAt:now,observedDate:'2026-09-11'},{id:'future',decisionId:'d',createdAt:now,observedDate:'2026-09-12'}];
 assert.deepEqual(selectCases(decisions,outcomes,[],now)[0].outcomes.map(o=>o.id),['today']);
 const c={memberGoal:'근력',scope:'general-adult',exerciseName:'스쿼트',confirmedRecordSignatures:[],planDate:'2026-09-11',planSnapshot:{savedAt:now,program:[{exerciseName:'스쿼트',sets:2}]}};
 const v=evaluateJudgment({goal:'근력',criteria:c,records:[{id:'r',date:'2026-09-11',exerciseName:'스쿼트',loadType:'weighted',sets:[]}]});
 assert.equal(v.cards.find(c=>c.id==='plan').status,'needs_information');
});
