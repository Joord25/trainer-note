import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactCoachingFacts,COACHING_INPUT_TOKENS} from '../coaching-input.mjs';
import {changeEvidence} from '../coaching-workflow.mjs';
import {createGemini} from '../gemini.mjs';
test('79 records keep every date, set, memo and evidence while redundant set copies disappear',()=>{
 const records=Array.from({length:79},(_,i)=>({id:'r'+i,date:`2026-09-${String(i%15+1).padStart(2,'0')}`,exerciseName:'운동'+i%5,bodyPart:'등',loadType:'weighted',measurementType:'repetitions',sets:Array.from({length:3},()=>({kg:15,reps:12})),notes:'원문 해석',trainerNote:'컨디션 관찰'}));
 const original={records,evidence:changeEvidence(records),sessionNotes:[{date:'2026-09-01',text:'수면 부족'}]},copy=structuredClone(original),compact=compactCoachingFacts(original);
 assert.deepEqual(original,copy);assert.deepEqual(compact.records,records);assert.deepEqual(compact.sessionNotes,original.sessionNotes);assert.equal(compact.evidence.length,original.evidence.length);
 for(let i=0;i<compact.evidence.length;i++){const e=compact.evidence[i];assert.deepEqual(e.recordIds,original.evidence[i].recordIds);if(e.kind==='exercise'){assert.equal(e.points.length,original.evidence[i].points.length);for(let j=0;j<e.points.length;j++){assert.equal(e.points[j].value,original.evidence[i].points[j].value);assert.deepEqual(e.points[j].recordIds,original.evidence[i].points[j].recordIds);assert.equal(e.points[j].sets,undefined);}}}
 assert(JSON.stringify(compact).length<JSON.stringify(original).length*.6);
});
test('unexpected evidence without matching raw records is never discarded',()=>{const p={recordIds:['missing'],sets:[{kg:20,reps:10}],conditions:[]};assert.deepEqual(compactCoachingFacts({records:[],evidence:[{points:[p]}]}).evidence[0].points[0],p);});
test('coaching budget accepts input above the old 32768 cap without dropping any records',async()=>{let generated=false;const model=createGemini({apiKey:()=> 'test',fetcher:async(url,request)=>{if(url.endsWith(':countTokens'))return {ok:true,json:async()=>({totalTokens:60000})};generated=true;assert.equal(JSON.parse(request.body).contents[0].parts[0].text,'complete input');return {ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:60000,totalTokenCount:60010}})};}});await model({system:'test',schema:{type:'OBJECT'},parts:[{text:'complete input'}],maxInputTokens:COACHING_INPUT_TOKENS,maxOutputTokens:6000});assert(generated);});
