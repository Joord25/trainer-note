import {test} from 'node:test';
import assert from 'node:assert/strict';
import {prepareReportInput,tabulateReportFacts} from '../report-input.mjs';
import {createGemini} from '../gemini.mjs';
const untabulate=v=>Array.isArray(v)?v.map(untabulate):v&&typeof v==='object'?(Array.isArray(v.columns)&&Array.isArray(v.rows)?v.rows.map(row=>Object.fromEntries(v.columns.map((k,i)=>[k,untabulate(row[i])]))):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,untabulate(x)]))):v;
test('large report table preserves all dates, sets, notes, zero and null',()=>{
 const facts={records:Array.from({length:120},(_,i)=>({id:'database-id-'+i,date:`2026-09-${i%28+1}`,sets:[{kg:0,reps:10},{kg:null,reps:12}],trainerNote:'R 어깨 통증 발생',notes:''})),mixed:[{a:1},{b:2}]};
 assert.deepEqual(untabulate(tabulateReportFacts(facts)),facts);
 assert.ok(JSON.stringify(tabulateReportFacts(facts)).length<JSON.stringify(facts).length);
});
test('compact evidence is restored before validation without rewriting prose',()=>{
 const facts={records:[{id:'long-database-id',sets:[]}],judgmentContext:{cards:[{evidenceIds:['long-database-id']}]}};
 const input=prepareReportInput(facts,{enum:['long-database-id']});
 assert.equal(input.facts.records[0].id,'record_1');assert.deepEqual(input.schema.enum,['record_1']);
 const restored=input.restore({overview:'record_1',findings:[{evidenceIds:['record_1']}],program:[{recordId:'record_1'}],judgments:{card:{evidenceIds:['record_1']}}});
 assert.equal(restored.overview,'record_1');assert.equal(restored.program[0].recordId,'long-database-id');assert.deepEqual(restored.findings[0].evidenceIds,['long-database-id']);assert.deepEqual(restored.judgments.card.evidenceIds,['long-database-id']);assert.equal(facts.records[0].id,'long-database-id');
});
test('over-budget report counts lossless compact input before a single generation',async()=>{
 const requests=[],facts={records:[{id:'a',sets:[]},{id:'b',sets:[]}]};
 const gemini=createGemini({apiKey:()=> 'test',fetcher:async(url,opts)=>{
  requests.push({url,body:JSON.parse(opts.body)});
  return {ok:true,json:async()=>requests.length<3?{totalTokens:requests.length===1?101:70}:{candidates:[{finishReason:'STOP',content:{parts:[{text:'{}'}]}}],usageMetadata:{promptTokenCount:70,totalTokenCount:75}}};
 }});
 await gemini({compactReportInput:true,system:'test',schema:{type:'OBJECT'},parts:[{text:JSON.stringify(facts)}],maxInputTokens:100,maxOutputTokens:10});
 assert.equal(requests.length,3);assert.ok(requests[0].url.endsWith(':countTokens'));assert.ok(requests[1].url.endsWith(':countTokens'));assert.ok(requests[2].url.endsWith(':generateContent'));
 const generated=JSON.parse(requests[2].body.contents[0].parts[0].text);assert.deepEqual(untabulate(generated),facts);
 assert.deepEqual(requests[1].body.generateContentRequest.contents,requests[2].body.contents);
});
test('still oversized report never generates or drops records',async()=>{
 let calls=0;const gemini=createGemini({apiKey:()=> 'test',fetcher:async()=>{calls++;return {ok:true,json:async()=>({totalTokens:101})};}});
 await assert.rejects(gemini({compactReportInput:true,system:'test',schema:{type:'OBJECT'},parts:[{text:JSON.stringify({records:[{id:'a'},{id:'b'}]})}],maxInputTokens:100,maxOutputTokens:10}),e=>e.notBillable===true&&e.inputTokens===101);
 assert.equal(calls,2);
});
