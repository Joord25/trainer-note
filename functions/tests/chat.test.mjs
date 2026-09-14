import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateChatRequest,validateChatAnswer,chatSchema,compactChatFacts} from '../chat.mjs';
const request={requestId:'11111111-1111-4111-a111-111111111111',question:'이번 기록은 어때?',fileId:'a'.repeat(64)};
test('chat rejects unbounded question, invalid source and foreign path traversal',()=>{for(const v of [{question:''},{question:'a'.repeat(1201)},{fileId:'../other'},{previousId:'../other'},{requestId:'x'}])assert.throws(()=>validateChatRequest({...request,...v}));});
test('selected image requires valid source/page/normalized bounds and bounded JPEG bytes',()=>{const s={page:1,rect:{x:0,y:0,width:.5,height:.5},image:'data:image/jpeg;base64,'+Buffer.from([255,216,255,...new Array(20).fill(0)]).toString('base64')};assert.ok(validateChatRequest({...request,selection:s}).image);for(const patch of [{page:0},{rect:{...s.rect,x:.8}},{image:'https://example.com/private.jpg'},{image:'data:image/jpeg;base64,'+'x'.repeat(500000)}])assert.throws(()=>validateChatRequest({...request,selection:{...s,...patch}}));});
test('chat references are limited to supplied records',()=>{assert.throws(()=>validateChatAnswer({answer:'답변',references:['foreign'],questions:[]},[{id:'local'}]));assert.deepEqual(validateChatAnswer({answer:'기록 없음',references:['none'],questions:[]},[]).references,[]);assert.throws(()=>validateChatAnswer({answer:'a'.repeat(2201),references:[],questions:[]},[]));});

test('screen capture has no fabricated file or page, but retains bounded JPEG validation',()=>{
 const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,...new Array(20).fill(0)]).toString('base64');
 const selection={kind:'screen',page:0,rect:{x:.2,y:.1,width:.5,height:.4},image};
 const result=validateChatRequest({...request,fileId:'',selection});
 assert.equal(result.selection.kind,'screen');assert.equal(result.selection.page,0);assert.ok(result.image.inlineData.data);assert.equal(result.selection.image,undefined);
 for(const patch of [{fileId:request.fileId},{selection:{...selection,page:1}},{selection:{...selection,kind:'other'}},{selection:{...selection,rect:{...selection.rect,width:1}}},{selection:{...selection,image:'data:image/png;base64,abcd'}},{selection:{...selection,image:'data:image/jpeg;base64,'+'x'.repeat(500000)}}])assert.throws(()=>validateChatRequest({...request,fileId:'',selection,...patch}));
 assert.throws(()=>validateChatRequest({...request,fileId:'',selection:{...selection,kind:'source',page:1}}));
});

test('search routing schema cannot silently skip an explicit web request',()=>{assert.deepEqual(chatSchema([],'공식 출처를 찾아줘').properties.searchDecision.enum,['search','blocked']);assert.deepEqual(chatSchema([],'검색 없이 설명해줘').properties.searchDecision.enum,['none','blocked']);});

function expandTable(value){
 if(Array.isArray(value))return value.map(expandTable);
 if(!value||typeof value!=='object')return value;
 if(Array.isArray(value.columns)&&Array.isArray(value.rows))return value.rows.map(row=>Object.fromEntries(value.columns.map((key,i)=>[key,expandTable(row[i])])));
 return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,expandTable(v)]));
}
test('large assistant context retains all records and conditions while removing duplicate set history',async()=>{
 const {summarize}=await import('../domain.mjs');
 const records=Array.from({length:120},(_,i)=>({id:`record-${i}`,date:`2026-08-${String(1+Math.floor(i/6)).padStart(2,'0')}`,rawName:'핵 스쿼트',exerciseName:'핵 스쿼트',bodyPart:'하체',measurementType:'repetitions',loadType:i%3===0?'bodyweight':i%3===1?'unknown':'weighted',sets:[{kg:i%3===2?40:null,reps:12},{kg:i%3===2?40:null,reps:10}],sourceHash:'a'.repeat(64),sourcePage:1,notes:'기구 조건 확인',trainerNote:i===0?'무릎 불편 호소, 운동량 조절':'',status:'confirmed'}));
 const summary=summarize(records),facts={question:'전체 기간의 조건 차이를 설명해줘',records,summary,training:{currentGoal:{goal:'근력'},memberDecisions:[{reason:'회복 확인 우선'}]},sessionNotes:[{date:records[0].date,text:'수면 부족'}],history:[{question:'이전 질문',answer:'이전 답변'}],capture:{kind:'screen',imageHash:'hash'},plan:[{exerciseName:'핵 스쿼트'}]};
 const before=JSON.stringify(facts),compact=compactChatFacts(facts);
 for(const key of ['question','records','training','sessionNotes','history','capture','plan'])assert.deepEqual(compact[key],facts[key]);
 const {exerciseTrends,...expected}=summary;
 assert.deepEqual(expandTable(compact.summary),expected);
 assert.equal(JSON.stringify(facts),before,'does not mutate stored facts');
 assert.ok(JSON.stringify(compact).length<before.length*.8,'meaningfully reduces repeated data');
 assert.equal(compact.records.length,120);
 const conditions=expandTable(compact.summary).exerciseLoadContext[0].days;
 assert.ok(conditions.some(day=>day.unknownSets>0&&day.volumeCoverage==='partial'));
});
test('summary set history is retained if not represented exactly by supplied records',()=>{
 const record={id:'a',date:'2026-08-01',sets:[{kg:0,reps:10}],sourceHash:'file',sourcePage:1};
 for(const patch of [{id:'missing'},{sets:[{kg:null,reps:10}]},{date:'2026-08-02'},{sourceHash:'other'},{sourcePage:2}]){
  const summary={exerciseTrends:[{name:'스쿼트',values:[{...record,...patch}]}]};
  assert.deepEqual(compactChatFacts({records:[record],summary}).summary.exerciseTrends,summary.exerciseTrends);
 }
 assert.deepEqual(compactChatFacts({records:[]}),{records:[]});
});

test('structured details render as real separate headings and list items',()=>{
 const value={answer:'상체 중심 구성입니다.',sections:[{title:'운동 구성',items:['푸시업 · 2세트 × 10회','체스트 프레스 · 10kg × 10회']}],references:['r'],questions:[]};
 assert.equal(validateChatAnswer(value,[{id:'r'}]).answer,'상체 중심 구성입니다.\n\n### 운동 구성\n- 푸시업 · 2세트 × 10회\n- 체스트 프레스 · 10kg × 10회');
 assert.throws(()=>validateChatAnswer({...value,sections:[{title:'오류',items:[1]}]},[{id:'r'}]));
});
