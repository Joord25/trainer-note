import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeEvidence,validateChanges} from '../coaching-workflow.mjs';
import {validateDecisionLenses,requireNarrativeSources} from '../goal-decision.mjs';
import {validateResearchExtract,researchCoaching} from '../coaching-research.mjs';
import {groundedResult} from '../web-search.mjs';
const records=[{id:'r1',date:'2026-10-01',exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',measurementType:'repetitions',sets:[{kg:8,reps:12}]}];
const evidence=changeEvidence(records),id=evidence.find(e=>e.bodyPart==='하체').id;
const direction={kind:'keep',goalAspect:'resistance',text:'8kg으로 수행해요.',reason:'기록 조건을 유지해요.',check:'수행 여유를 확인해요.',evidenceIds:[id]};
const report=()=>({headline:'기록을 확인해요.',findings:[{evidenceId:id,interpretation:'기록을 비교해요.',uncertainty:'추가 기록이 필요해요.'}],directions:[{...direction}]});
const options={omitInvalidDirections:true};
const sources=[{id:'WEB1',title:'Verified study',url:'https://www.who.int/guideline',type:'공개 본문 확인'}];
test('invalid directions are isolated; retained content and original direction IDs are unchanged',()=>{
 const base=report();const expected=validateChanges(base,evidence);
 for(const invalid of [null,{...direction,evidenceIds:[]},{...direction,evidenceIds:['foreign']},{...direction,text:'100kg으로 진행해요.'},{...direction,reason:'미확인 주장 [웹99]'},{...direction,kind:'invalid'},{...direction,check:''}]){
  const draft={...base,directions:[invalid,direction]};
  const out=validateChanges(draft,evidence,options);
  assert.deepEqual(out.findings,expected.findings);assert.equal(out.headline,expected.headline);
  assert.deepEqual(out.directions,[{...expected.directions[0],id:'direction-2'}]);
  assert.equal(out.warnings.length,1);assert.throws(()=>validateChanges(draft,evidence));
 }
});
test('all invalid proposals leave validated analysis available without inventing replacements',()=>{
 const out=validateChanges({...report(),directions:[null,{...direction,evidenceIds:[]}]},evidence,options);
 assert.equal(out.findings.length,1);assert.deepEqual(out.directions,[]);assert.equal(out.warnings.length,1);
});
test('partial direction recovery cannot bypass invalid main findings or invented main citations',()=>{
 assert.throws(()=>validateChanges({...report(),findings:[{evidenceId:'foreign'}]},evidence,options),/근거/);
 assert.throws(()=>validateChanges({...report(),headline:'근거 없는 주장 [웹99]'},evidence,options),e=>!!e.repairHint&&/주장/.test(e.repairHint));
});
test('unverified optional regional explanation is excluded without losing valid regional evidence',()=>{
 const out=validateChanges({...report(),regionalComments:[{region:'하체',comment:'미확인 주장 [웹99]',evidenceIds:[id]},{region:'하체',comment:'검증된 기록이에요.',evidenceIds:[id]}]},evidence,options);
 assert.equal(out.regionalComments.length,1);assert.equal(out.regionalComments[0].comment,'검증된 기록이에요.');assert.equal(out.findings.length,1);
});
test('verified web citations survive mandatory NASM and WHO checks, but cannot substitute for them',()=>{
 for(const [id,sourceId,name] of [['resistance','NASM-OPT','NASM'],['aerobic','WHO2020','WHO']]){
  const lens={id,interpretation:'기록을 비교해요.',comparison:`${name} 기준과 검증된 연구 [웹1]를 비교해요.`,recommendation:'같은 조건에서 확인해요.',question:'',sourceIds:[sourceId,'WEB1']};
  const out=validateDecisionLenses([lens],[{id}],sources);
  assert.deepEqual(out[0].references.map(s=>s.id),[sourceId,'WEB1']);
  assert.throws(()=>validateDecisionLenses([{...lens,comparison:'검증된 연구 [웹1]를 비교해요.'}],[{id}],sources),e=>!!e.repairHint);
 }
 assert.throws(()=>requireNarrativeSources('미확인 [웹9]',[],'종합',sources),e=>!!e.repairHint&&e.repairHint.includes('WEB1'));
});
const excerpt='Adults should do regular physical activity throughout the week.';
const doc={url:sources[0].url,title:'WHO guide',coverage:'공개 본문 확인',body:(excerpt+' ').repeat(30)};
const item={index:0,documentKind:'guideline',excerpt,claim:'주간 활동을 권장해요.',scope:'성인 일반 기준이에요.'};
test('malformed and rejected extracts do not discard verified items; IDs follow retained sources',()=>{
 const items=[null,{}, {...item,index:'0'}, {...item,documentKind:'unsupported'}, {...item,excerpt:'A claim missing from the original document.'},item,{...item,index:1}];
 const out=validateResearchExtract({items},[doc,{...doc,url:'https://www.acsm.org/guide'}],'today');
 assert.deepEqual(out.map(s=>[s.id,s.url]),[['WEB1',doc.url],['WEB2','https://www.acsm.org/guide']]);
});
test('a failing source and rejected candidate do not prevent remaining official source verification',async()=>{
 const result=await researchCoaching({uid:'test',facts:{},fetcher:async url=>url.endsWith('/failed')?new Response('',{status:400}):new Response('<title>WHO guide</title><main>'+doc.body+'</main>',{headers:{'content-type':'text/html'}}),paid:async(_uid,kind)=>({value:kind==='coaching-search-plan'?{query:'WHO physical activity adults'}:kind==='search-safety'?{allowed:true,reason:'safe'}:kind==='coaching-web-search'?{sources:[null,{url:'https://example.com/unsupported'},{url:'https://www.who.int/failed'},{url:doc.url}],searchSuggestions:''}:{items:[null,item]}})});
 assert.equal(result.status,'verified');assert.deepEqual(result.sources.map(s=>s.url),[doc.url]);
});
test('malformed provider supports are skipped and safe citation numbering stays aligned',()=>{
 const out=groundedResult({candidates:[{groundingMetadata:{webSearchQueries:['training'],groundingSupports:[null,{}, {segment:{text:'bad'},groundingChunkIndices:4},{segment:{text:'검증된 설명'},groundingChunkIndices:[0,1]}],groundingChunks:[{web:{uri:'javascript:bad',title:'bad'}},{web:{uri:doc.url,title:doc.title}}],searchEntryPoint:{renderedContent:'<div>Google</div>'}}}]});
 assert.equal(out.text,'검증된 설명 [웹1]');assert.deepEqual(out.sources,[{url:doc.url,title:doc.title}]);
});

test('an empty proposal list does not invalidate a verified report in partial mode',()=>{
 const out=validateChanges({...report(),directions:[]},evidence,options);
 assert.equal(out.findings.length,1);assert.deepEqual(out.directions,[]);assert.equal(out.warnings.length,1);
 assert.throws(()=>validateChanges({...report(),directions:[]},evidence));
});
