import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGemini} from '../gemini.mjs';
import {safeError} from '../service.mjs';
import {openApiSchema,reportEvidenceSchema,programBounds} from '../domain.mjs';
import {GOAL_SCHEMA} from '../goal-coaching.mjs';
import {ASSESSMENT_SCHEMA,assessmentResult} from '../assessment.mjs';

test('goal and assessment schemas contain no Gemini-invalid empty enum entries',()=>{
 const walk=node=>{if(!node||typeof node!=='object')return;if(node.enum)assert.ok(node.enum.every(v=>v!==''));for(const value of Object.values(node))walk(value);};
 walk(GOAL_SCHEMA);walk(ASSESSMENT_SCHEMA);
 // The response still goes through the application source allowlist.
 assert.throws(()=>assessmentResult({title:'평가',purpose:'체력',steps:[{name:'운동',details:'1분'}],target:'',measures:['횟수'],conditions:[],questions:[],metrics:['cardio'],sourceId:'invented'},'recommend'));
});
test('preflight rejection is distinct from input size and never starts generation',async()=>{
 for(const [response,pattern] of [[{ok:false,status:400,json:async()=>({error:{message:'schema rejected'}})},/AI 서비스 요청/],[{ok:true,json:async()=>({totalTokens:101})},/기록이 너무 많아요/],[{ok:true,json:async()=>({})},/AI 서비스 응답/]]){
  let calls=0;const gemini=createGemini({apiKey:()=> 'test',fetcher:async()=>{calls++;return response;}});
  await assert.rejects(gemini({system:'test',schema:GOAL_SCHEMA,parts:[{text:'test'}],maxInputTokens:100,maxOutputTokens:50}),e=>pattern.test(e.message)&&e.notBillable===true);
  assert.equal(calls,1);
 }
});

test('both onboarding schemas retain the two-question limit after API conversion',()=>{
 assert.equal(openApiSchema(ASSESSMENT_SCHEMA).properties.questions.maxItems,2);
 assert.equal(openApiSchema(GOAL_SCHEMA).properties.questions.maxItems,2);
 assert.equal(openApiSchema(GOAL_SCHEMA).properties.assessment.properties.questions.maxItems,2);
});

test('goal adjustment validation stays actionable in the callable error response',()=>{
 const message='제안한 목표·평가에서 조정한 이유를 남겨주세요.';
 assert.equal(safeError(new Error(message)),message);
});


test('extraction omits nested API array bounds while onboarding keeps its question cap',async()=>{
 const {EXTRACTION_SCHEMA,parseExtraction}=await import('../generated/extraction.mjs');
 const schema=openApiSchema(EXTRACTION_SCHEMA,{arrayLimits:false});
 const walk=node=>{if(!node||typeof node!=='object')return;assert.equal(node.maxItems,undefined);for(const value of Object.values(node))walk(value);};
 walk(schema);
 assert.equal(schema.properties.records.items.properties.sets.items.properties.kg.nullable,true);
 assert.equal(openApiSchema(GOAL_SCHEMA).properties.questions.maxItems,2);
 assert.equal(EXTRACTION_SCHEMA.properties.records.maxItems,60);
 await assert.rejects(parseExtraction({records:Array(61).fill({}),unparsed:[]},{id:'a'.repeat(64),name:'test.png'},'회원',2026),/너무 많은 항목/);
});


test('report generation can reference only supplied records and uses per-side rep bounds',()=>{
 const rows=[{id:'strength',sets:[{reps:20,leftReps:8,rightReps:12},{reps:20,leftReps:10,rightReps:10}]},{id:'cardio',measurementType:'distance_time',sets:[{distanceMeters:200,durationSeconds:40}]}];
 const schema=reportEvidenceSchema(rows);
 assert.deepEqual(schema.properties.findings.items.properties.evidenceIds.items.enum,['strength','cardio']);
 assert.deepEqual(schema.properties.program.items.properties.recordId.enum,['strength']);
 assert.deepEqual(programBounds(rows),[{recordId:'strength',maxSets:2,minReps:8,maxReps:12}]);
 assert.deepEqual(reportEvidenceSchema([]).properties.program.items.properties.recordId.enum,['none']);
});
