import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {rowAlertKey,unparsedAlertKey,visibleUnparsed,isReviewAlertVisible} from '../generated/review-alerts.mjs';
import {createService} from '../service.mjs';
import {LIMITS,costMicros} from '../domain.mjs';
const judgments=facts=>facts.judgmentContext.cards.map(c=>({cardId:c.id,version:c.version,status:c.status,observation:c.reason,interpretation:'조건 범위 내 참고',question:'',action:'트레이너 확인',evidenceIds:c.evidenceIds,caseIds:[]}));
let app,db,service,calls,queued,answer,provider,clock;
const uid='service-test',mid='member',fileId='a'.repeat(64),base=`trainers/${uid}/members/${mid}`;
const raw=(patch={})=>({records:[{page:1,memberName:'회원 A',year:2026,month:6,day:9,rawName:'BB squat',exerciseName:'바벨 스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:40,reps:12},{kg:60,reps:10}],notes:'',issues:[],...patch}],unparsed:[]});
function make(limits=LIMITS){return createService({db,now:()=>clock,limits,readSource:async()=>'',enqueue:async(...v)=>queued.push(v),model:async request=>{calls.push(request);if(provider)return provider(request);if(request.parts[1])return {value:answer,usage:{inputTokens:2000,outputTokens:600}};const facts=JSON.parse(request.parts[0].text),r=facts.records[0];return {value:{judgments:judgments(facts),headline:'최근 기록',overview:'기록에 근거한 분석',findings:[{title:'세트',detail:'수행 기록 확인',evidenceIds:[r.id]}],limitations:['컨디션 확인 필요'],questions:[],program:[{recordId:r.id,exerciseName:r.exerciseName,bodyPart:r.bodyPart,sets:1,reps:'10',loadGuide:'이전 수행 조건 확인',reason:'최근 기록'}],quests:[]},usage:{inputTokens:1500,outputTokens:500}};}});}
const imported=async()=> (await db.doc(base+'/imports/'+fileId).get()).data();
const records=async()=> (await db.collection(base+'/records').get()).docs.map(d=>({id:d.id,...d.data()}));
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required; never run against live data');app=initializeApp({projectId:'demo-trainer-note'},'service-tests');db=getFirestore(app);});
after(async()=>{await deleteApp(app);});
beforeEach(async()=>{const host=process.env.FIRESTORE_EMULATOR_HOST;const r=await fetch(`http://${host}/emulator/v1/projects/demo-trainer-note/databases/(default)/documents`,{method:'DELETE'});assert.ok(r.ok);calls=[];queued=[];provider=null;answer=raw();clock=Date.parse('2026-09-11T00:00:00Z');service=make();await db.doc(base).set({name:'회원 A',goal:'꾸준한 운동',notes:'',recordCount:0});await db.doc(base+'/files/'+fileId).set({name:'일지.png',contentType:'image/png',size:100,status:'ready'});});
test('one extraction persists, reopening and simultaneous read reuse it',async()=>{await Promise.all([service.startImport(uid,mid,fileId),service.startImport(uid,mid,fileId)]);assert.equal(calls.length,1);assert.equal((await imported()).status,'ready');assert.equal((await records())[0].status,'provisional');assert.equal((await db.doc(base).get()).data().recordCount,1);await service.startImport(uid,mid,fileId,true);assert.equal(calls.length,1);});
test('only ambiguous rows wait, clean rows flow to analysis',async()=>{answer.records.push({...raw({rawName:'unknown',exerciseName:'모호한 운동',issues:['운동명 확인']}).records[0]});await service.startImport(uid,mid,fileId);assert.equal((await records()).length,1);assert.equal((await imported()).rows.filter(r=>r.review==='needs-review').length,1);await service.buildReport(uid,mid);const a=(await db.doc(base+'/analysis/current').get()).data();assert.equal(a.excludedCount,1);assert.equal(a.summary.sets,2);assert.equal(a.report.program.length,1);});
test('missing year and member are bulk corrected without rereading model',async()=>{answer=raw({year:null,memberName:''});await service.startImport(uid,mid,fileId);assert.equal((await records()).length,0);let v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:v.revision});v=await imported();assert.equal(v.rows[0].review,'needs-review');await service.reviewImport(uid,mid,fileId,{operation:'member',revision:v.revision});assert.equal((await records())[0].performedAt.toDate().getUTCFullYear(),2025);assert.equal(calls.length,1);v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2026,revision:v.revision});assert.equal((await records())[0].performedAt.toDate().getUTCFullYear(),2026);assert.equal((await db.doc(base).get()).data().recordCount,1);});
test('trainer edit wins over later bulk corrections and stale editor cannot overwrite',async()=>{answer=raw({year:null});await service.startImport(uid,mid,fileId);let v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:v.revision});v=await imported();const input={...v.rows[0].input,exerciseName:'트레이너 확인 스쿼트'};await service.reviewImport(uid,mid,fileId,{operation:'row',rowId:v.rows[0].id,input,revision:v.revision,reason:'변형 확인'});await assert.rejects(service.reviewImport(uid,mid,fileId,{operation:'row',rowId:v.rows[0].id,input,revision:v.revision}));v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2026,revision:v.revision});const r=(await records())[0];assert.equal(r.exerciseName,'트레이너 확인 스쿼트');assert.equal(r.performedAt.toDate().getUTCFullYear(),2025);assert.equal(r.status,'confirmed');assert.equal((await db.collection(base+'/corrections').get()).size,1);});
test('invalid year correction removes only provisional data from analysis',async()=>{answer=raw({year:null,month:2,day:29});await service.startImport(uid,mid,fileId);let v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2024,revision:v.revision});assert.equal((await records()).length,1);v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:v.revision});assert.equal((await records()).length,0);assert.equal((await db.doc(base).get()).data().recordCount,0);});
test('combined report and program cached without further paid calls',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);assert.equal(calls.length,2);await service.buildReport(uid,mid);assert.equal(calls.length,2);const usage=(await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data();assert.equal(usage.usedMicros,costMicros(3500,1100));assert.equal(usage.reservedMicros,0);assert.equal(usage.inputTokens,3500);});
test('empty or pending-only reports never cost tokens',async()=>{answer=raw({year:null,month:null});await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);assert.equal(calls.length,1);assert.equal((await db.doc(base+'/analysis/current').get()).data().report.program.length,0);});
test('goal changes invalidate report, saved trainer plan is preserved',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);const a=(await db.doc(base+'/analysis/current').get()).data();await service.savePlan(uid,mid,{program:a.report.program,reason:'오늘 컨디션 반영',revision:0,basedOn:a.fingerprint});await assert.rejects(service.savePlan(uid,mid,{program:a.report.program,reason:'오래된 화면',revision:0}));await db.doc(base).update({goal:'새 목표'});await service.buildReport(uid,mid);assert.equal(calls.length,3);assert.equal((await db.doc(base+'/plans/current').get()).data().reason,'오늘 컨디션 반영');});
test('unlimited policy ignores previous caps but preserves usage accounting',async()=>{
 assert.equal(LIMITS.dailyCalls,null);assert.equal(LIMITS.monthlyMicros,null);assert.equal(LIMITS.globalMonthlyMicros,null);
 const usage=db.doc(`trainers/${uid}/aiUsage/2026-09`),daily=db.doc(`trainers/${uid}/aiDaily/2026-09-11`),global=db.doc('aiGlobalUsage/2026-09');
 await usage.set({usedMicros:2_000_000,calls:66,reservedMicros:0,monthlyLimitMicros:1_000_000,dailyLimit:30});
 await daily.set({calls:30});await global.set({usedMicros:25_000_000,reservedMicros:0});
 await service.paid(uid,'test',{parts:[{},{}]},100);
 const u=(await usage.get()).data();assert.equal(calls.length,1);assert.equal((await daily.get()).data().calls,31);
 assert.equal(u.calls,67);assert.equal(u.usedMicros,2_000_000+costMicros(2000,600));assert.equal(u.reservedMicros,0);
 assert.equal(u.monthlyLimitMicros,null);assert.equal(u.dailyLimit,null);assert.equal(u.inputTokens,2000);
 assert.equal((await global.get()).data().usedMicros,25_000_000+costMicros(2000,600));
});
test('concurrent paid requests cannot race beyond daily allowance',async()=>{service=make({...LIMITS,dailyCalls:1});const result=await Promise.allSettled([service.paid(uid,'test',{parts:[{},{}]},100),service.paid(uid,'test',{parts:[{},{}]},100)]);assert.equal(result.filter(v=>v.status==='fulfilled').length,1);assert.equal(calls.length,1);});
for(const cap of ['monthlyMicros','globalMonthlyMicros'])test(`${cap} reserves before provider call`,async()=>{service=make({...LIMITS,[cap]:1});await assert.rejects(service.paid(uid,'test',{parts:[{},{}]},100),/AI_USAGE_LIMIT/);assert.equal(calls.length,0);});
test('unknown provider failure conservatively charges reservation and releases lock',async()=>{provider=async()=>{throw Error('timeout');};await assert.rejects(service.paid(uid,'test',{},100));const v=(await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data();assert.equal(v.usedMicros,costMicros(LIMITS.maxInputTokens,100));assert.equal(v.reservedMicros,0);});
test('preflight rejection charges no model cost',async()=>{provider=async()=>{throw Object.assign(Error('input too large'),{notBillable:true});};await assert.rejects(service.paid(uid,'test',{},100));assert.equal((await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data().usedMicros,0);});
test('malformed response usage is charged once and retry is explicit',async()=>{provider=async()=>({value:{bad:true},usage:{inputTokens:1000,outputTokens:300}});await service.startImport(uid,mid,fileId);assert.equal((await imported()).status,'error');await service.startImport(uid,mid,fileId);assert.equal(calls.length,1);provider=null;await service.startImport(uid,mid,fileId,true);assert.equal(calls.length,2);assert.equal((await imported()).status,'ready');});
test('generation changed during model call cannot publish stale report',async()=>{await service.startImport(uid,mid,fileId);provider=async request=>{const facts=JSON.parse(request.parts[0].text),r=facts.records[0];await db.doc(base).update({goal:'수정된 목표'});return {value:{judgments:judgments(facts),headline:'오래된 분석',overview:'',findings:[],limitations:[],questions:[],program:[],quests:[]},usage:{inputTokens:100,outputTokens:100}};};const r=await service.buildReport(uid,mid);assert.equal(r.stale,true);assert.notEqual((await db.doc(base+'/analysis/current').get()).data().report?.headline,'오래된 분석');assert.equal((await db.doc(base+'/analysis/current').get()).data().status,'queued');});
test('large file gives visible error without paying provider',async()=>{await db.doc(base+'/files/'+fileId).update({size:11*1024*1024});await service.startImport(uid,mid,fileId);assert.equal(calls.length,0);assert.match((await imported()).error,/10MB/);});
test('deleted member never generates or saves results',async()=>{await db.doc(base).delete();await assert.rejects(service.startImport(uid,mid,fileId));await service.buildReport(uid,mid);assert.equal(calls.length,0);assert.equal((await db.doc(base+'/analysis/current').get()).exists,false);});
test('queue combines edits before worker starts but permits follow-up while processing',async()=>{await service.scheduleReport(uid,mid);await service.scheduleReport(uid,mid);assert.equal(queued.length,1);await db.doc(base+'/analysis/current').update({status:'processing'});await service.scheduleReport(uid,mid);assert.equal(queued.length,2);assert.notEqual(queued[0][1],queued[1][1]);});

test('record corrections reuse extraction; unchanged analysis fields reuse report',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);const r=(await records())[0];await db.doc(base+'/records/'+r.id).update({revision:2,rawName:'cosmetic original text fix'});await service.buildReport(uid,mid);assert.equal(calls.length,2);await db.doc(base+'/records/'+r.id).update({revision:3,sets:[{kg:40,reps:12},{kg:70,reps:10}]});await service.buildReport(uid,mid);assert.equal(calls.length,3);assert.equal(calls.filter(c=>c.parts[1]).length,1);assert.equal((await db.doc(base+'/analysis/current').get()).data().summary.volume,1180);});

const decisionInput=(fingerprint,patch={})=>({requestId:'11111111-1111-4111-a111-111111111111',fingerprint,cardId:'goal-data',choice:'check',reason:'목표 측정을 먼저 확인',alternative:'바로 증량',changeCondition:'수행 조건이 같으면 재검토',followUpMetric:'같은 무게의 횟수',followUpDate:'2026-09-15',...patch});
test('judgment cards are supplied to model and validated in report',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);const facts=JSON.parse(calls[1].parts[0].text),a=(await db.doc(base+'/analysis/current').get()).data();assert.equal(facts.judgmentContext.cards.length,5);assert.equal(a.report.judgments.length,5);assert.ok(a.report.judgments.every(j=>j.status==='needs_information'));});
test('decision snapshot, failure outcome and reason are reused without another extraction',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);const a=(await db.doc(base+'/analysis/current').get()).data(),d=decisionInput(a.fingerprint);await service.saveJudgmentDecision(uid,mid,d);await service.saveJudgmentDecision(uid,mid,d);assert.equal((await db.collection(base+'/judgmentDecisions').get()).size,1);await service.buildReport(uid,mid);let facts=JSON.parse(calls.at(-1).parts[0].text);assert.equal(facts.judgmentContext.cases[0].reason,d.reason);const original=(await db.doc(base+'/judgmentDecisions/'+d.requestId).get()).data().snapshot;clock+=86400000;await service.saveJudgmentOutcome(uid,mid,{requestId:'22222222-2222-4222-a222-222222222222',decisionId:d.requestId,result:'different',note:'같은 무게에서 횟수 감소',observedDate:'2026-09-12'});await service.buildReport(uid,mid);facts=JSON.parse(calls.at(-1).parts[0].text);assert.equal(facts.judgmentContext.cases[0].outcomes[0].result,'different');assert.deepEqual((await db.doc(base+'/judgmentDecisions/'+d.requestId).get()).data().snapshot,original);assert.equal(calls.filter(c=>c.parts[1]).length,1);const charged=calls.length;await service.buildReport(uid,mid);assert.equal(calls.length,charged);});
test('unowned member decision, nonexistent outcome parent and future outcome rejected',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);const a=(await db.doc(base+'/analysis/current').get()).data();await assert.rejects(service.saveJudgmentDecision('other-trainer',mid,decisionInput(a.fingerprint)));await service.saveJudgmentDecision(uid,mid,decisionInput(a.fingerprint));await assert.rejects(service.saveJudgmentOutcome(uid,mid,{requestId:'22222222-2222-4222-a222-222222222222',decisionId:'33333333-3333-4333-a333-333333333333',result:'unclear',note:'관찰',observedDate:'2026-09-11'}));await assert.rejects(service.saveJudgmentOutcome(uid,mid,{requestId:'22222222-2222-4222-a222-222222222222',decisionId:decisionInput('').requestId,result:'unclear',note:'관찰',observedDate:'2026-09-20'}));});
test('criteria stored with record signatures and stale revisions rejected',async()=>{await service.startImport(uid,mid,fileId);const input={scope:'general-adult',conditionsConfirmed:true,exerciseName:'바벨 스쿼트',equipment:'같은 바벨',loadBasis:'양측 합',side:'양측',setPurpose:'본 운동',loadKg:40,targetReps:15,minSessions:3,windowDays:28,planDate:''};await service.saveJudgmentCriteria(uid,mid,{revision:0,input});await assert.rejects(service.saveJudgmentCriteria(uid,mid,{revision:0,input}));await service.buildReport(uid,mid);let a=(await db.doc(base+'/analysis/current').get()).data();assert.equal(a.judgmentContext.cards[0].status,'candidate');const r=(await records())[0];await db.doc(base+'/records/'+r.id).update({revision:2,notes:'기구 변경'});await service.buildReport(uid,mid);a=(await db.doc(base+'/analysis/current').get()).data();assert.equal(a.judgmentContext.cards[0].status,'needs_information');});
test('correction reason alone invalidates report cache',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);await db.doc(base+'/corrections/reason').set({before:{exerciseName:'스쿼트'},after:{exerciseName:'스쿼트'},reason:'중량 감소는 자세 집중 때문',createdAt:Timestamp.fromMillis(clock)});await service.buildReport(uid,mid);assert.equal(calls.length,3);assert.equal(JSON.parse(calls[2].parts[0].text).corrections[0].reason,'중량 감소는 자세 집중 때문');});

test('outcome on current Korean morning is valid and previous day is rejected',async()=>{
 clock=Date.parse('2026-09-10T23:00:00Z');await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);
 const a=(await db.doc(base+'/analysis/current').get()).data(),d=decisionInput(a.fingerprint);await service.saveJudgmentDecision(uid,mid,d);
 const result={requestId:'44444444-4444-4444-a444-444444444444',decisionId:d.requestId,result:'unclear',note:'당일 상태 관찰',observedDate:'2026-09-11'};
 await service.saveJudgmentOutcome(uid,mid,result);await service.buildReport(uid,mid);
 assert.equal(JSON.parse(calls.at(-1).parts[0].text).judgmentContext.cases[0].outcomes[0].observedDate,'2026-09-11');
 await assert.rejects(service.saveJudgmentOutcome(uid,mid,{...result,requestId:'55555555-5555-4555-a555-555555555555',observedDate:'2026-09-10'}));
});

test('compound extraction writes two provisional records with no duplicate parent count',async()=>{answer.records=[{...raw().records[0],rawName:'Cable ext + DB curl',sets:[],issues:[],components:[{rawName:'Cable ext',exerciseName:'케이블 익스텐션',bodyPart:'삼두',loadType:'weighted',sets:[{kg:20,reps:8}],notes:'',issues:[],mapping:'20/5 첫 무게, 8/10 첫 횟수'},{rawName:'DB curl',exerciseName:'덤벨 컬',bodyPart:'이두',loadType:'weighted',sets:[{kg:5,reps:10}],notes:'',issues:[],mapping:'20/5 둘째 무게, 8/10 둘째 횟수'}]}];await service.startImport(uid,mid,fileId);assert.equal((await records()).length,2);assert.equal((await db.doc(base).get()).data().recordCount,2);await service.startImport(uid,mid,fileId);assert.equal(calls.length,1);assert.equal((await records()).length,2);});
const chatInput=(patch={})=>({requestId:'77777777-7777-4777-a777-777777777777',question:'무엇이 달라졌나요?',fileId,...patch});
test('chat uses current owned records, persists answer and reuses same request without payment',async()=>{await service.startImport(uid,mid,fileId);provider=async request=>{const facts=JSON.parse(request.parts[0].text);assert.equal(facts.records.length,1);return {value:{answer:'기록을 먼저 비교해보세요.',references:[facts.records[0].id],questions:[]},usage:{inputTokens:100,outputTokens:50}};};const a=await service.chat(uid,mid,chatInput());assert.equal(a.references.length,1);const n=calls.length;await service.chat(uid,mid,chatInput());assert.equal(calls.length,n);assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().status,'ready');await assert.rejects(service.chat(uid,mid,chatInput({question:'다른 내용'})));});
test('chat cannot read another trainer, member source or foreign conversation',async()=>{await service.startImport(uid,mid,fileId);const n=calls.length;await assert.rejects(service.chat('foreign',mid,chatInput()));await assert.rejects(service.chat(uid,mid,chatInput({fileId:'b'.repeat(64)})));await assert.rejects(service.chat(uid,mid,chatInput({previousId:'88888888-8888-4888-a888-888888888888'})));assert.equal(calls.length,n);});
test('chat enforces existing cost cap and rejects fabricated citations',async()=>{await service.startImport(uid,mid,fileId);provider=async()=>({value:{answer:'없는 기록',references:['foreign'],questions:[]},usage:{inputTokens:100,outputTokens:10}});await assert.rejects(service.chat(uid,mid,chatInput()));assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().status,'error');const n=calls.length;await assert.rejects(service.chat(uid,mid,chatInput()));assert.equal(calls.length,n);service=make({...LIMITS,dailyCalls:0});await assert.rejects(service.chat(uid,mid,chatInput({requestId:'99999999-9999-4999-a999-999999999999'})));assert.equal(calls.length,n);});

test('year defaults to Korean current year but explicit source year wins',async()=>{answer=raw({year:null});answer.records.push({...raw({rawName:'last year',year:2025}).records[0]});await service.startImport(uid,mid,fileId);const v=await imported();assert.equal(v.year,2026);assert.equal(v.rows[0].input.date,'2026-06-09');assert.match(v.rows[0].input.notes,/연도 기본값: 2026/);assert.equal(v.rows[1].input.date,'2025-06-09');assert.equal((await records()).length,2);});
test('page date applies atomically to that page only and preserves unrelated issues',async()=>{await db.doc(base+'/files/'+fileId).update({contentType:'application/pdf'});answer=raw({year:null,month:null});answer.records.push({...raw({rawName:'ambiguous',year:null,month:null,issues:['세트 판독 모호']}).records[0]},{...raw({rawName:'page two',page:2}).records[0]});await service.startImport(uid,mid,fileId);let v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'date',page:1,date:'2025-07-01',revision:v.revision});v=await imported();assert.equal(v.rows[0].input.date,'2025-07-01');assert.equal(v.rows[1].review,'needs-review');assert.ok(v.rows[1].issues.includes('세트 판독 모호'));assert.equal(v.rows[2].input.date,'2026-06-09');assert.equal((await records()).length,2);await assert.rejects(service.reviewImport(uid,mid,fileId,{operation:'date',page:1,date:'2025-02-29',revision:v.revision}));await service.reviewImport(uid,mid,fileId,{operation:'year',year:2024,revision:v.revision});v=await imported();assert.equal(v.rows[0].input.date,'2025-07-01');assert.equal(v.rows[1].input.date,'2025-07-01');assert.equal(calls.length,1);});
test('adding unparsed creates one linked record and stays resolved after year change',async()=>{answer.unparsed=[{page:1,text:'air bike X 50',reason:'단위 확인'}];await service.startImport(uid,mid,fileId);let v=await imported();const request={operation:'add',rowId:'1234567890abcdefghij',unparsedIndex:0,input:{...v.rows[0].input,rawName:'air bike X 50',exerciseName:'확인한 운동'},revision:v.revision};await service.reviewImport(uid,mid,fileId,request);assert.equal((await imported()).unparsed.length,0);assert.equal((await records()).length,2);assert.equal((await db.doc(base).get()).data().recordCount,2);await assert.rejects(service.reviewImport(uid,mid,fileId,request));v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:v.revision});assert.equal((await imported()).unparsed.length,0);assert.equal((await records()).length,2);assert.equal(calls.length,1);});
test('page date includes manually added records and rejects stale or foreign requests',async()=>{await service.startImport(uid,mid,fileId);let v=await imported();const r=(await records())[0];await db.doc(base+'/records/manualRecord123456789').set({...r,sourcePage:1,revision:1});await service.reviewImport(uid,mid,fileId,{operation:'date',page:1,date:'2025-08-01',revision:v.revision});assert.ok((await records()).every(r=>r.performedAt.toDate().toISOString().startsWith('2025-08-01')));await assert.rejects(service.reviewImport(uid,mid,fileId,{operation:'date',page:1,date:'2024-08-01',revision:v.revision}));await assert.rejects(service.reviewImport('foreign',mid,fileId,{operation:'date',page:1,date:'2024-08-01',revision:v.revision+1}));});
test('explicit regeneration bypasses cache once and keeps member schema intact',async()=>{await service.startImport(uid,mid,fileId);await service.buildReport(uid,mid);const n=calls.length;await service.retryReport(uid,mid,true);await service.buildReport(uid,mid);assert.equal(calls.length,n+1);await service.buildReport(uid,mid);assert.equal(calls.length,n+1);assert.equal((await db.doc(base).get()).data().analysisGeneration,undefined);});

test('same row can be edited twice while unrelated import revisions change',async()=>{
 await service.startImport(uid,mid,fileId);let v=await imported(),r=v.rows[0];
 await service.reviewImport(uid,mid,fileId,{operation:'row',rowId:r.id,revision:v.revision,rowRevision:r.revision,recordRevision:1,input:{...r.input,notes:'첫 수정'}});
 v=await imported();r=v.rows[0];await db.doc(base+'/imports/'+fileId).update({revision:v.revision+1});
 await service.reviewImport(uid,mid,fileId,{operation:'row',rowId:r.id,revision:v.revision,rowRevision:r.revision,recordRevision:2,input:{...r.input,notes:'두 번째 수정'}});
 assert.equal((await records())[0].notes,'두 번째 수정');assert.equal((await records())[0].revision,3);
 await assert.rejects(service.reviewImport(uid,mid,fileId,{operation:'row',rowId:r.id,revision:v.revision,rowRevision:r.revision,recordRevision:2,input:r.input}));
});
test('committed correction stays successful if report queue is unavailable',async()=>{
 await service.startImport(uid,mid,fileId);const v=await imported(),r=v.rows[0];clock+=30000;
 const disconnected=createService({db,now:()=>clock,readSource:async()=>'',model:async()=>{throw Error('unexpected model');},enqueue:async()=>{throw Error('queue down');}});
 await disconnected.reviewImport(uid,mid,fileId,{operation:'row',rowId:r.id,revision:v.revision,input:{...r.input,notes:'저장 완료'}});
 assert.equal((await records())[0].notes,'저장 완료');assert.equal((await db.doc(base+'/analysis/current').get()).data().status,'error');
});
test('trainer-approved SkiErg interpretation persists atomically and can be edited/deleted',async()=>{
 await service.startImport(uid,mid,fileId);let v=await imported();const input={...v.rows[0].input,rawName:'sky erg',exerciseName:'스키에르그',measurementType:'distance_time',loadType:'unknown',sets:[{kg:null,reps:0,distanceMeters:200,durationSeconds:32}],notes:'200m를 마친 초. 휴식 60초.'};
 await service.reviewImport(uid,mid,fileId,{operation:'row',rowId:v.rows[0].id,revision:v.revision,input,rememberInterpretation:true});
 const rule=(await db.collection(`trainers/${uid}/interpretations`).get()).docs[0];assert.equal(rule.data().explanation,input.notes);assert.equal((await records())[0].measurementType,'distance_time');
 await service.saveInterpretation(uid,mid,{id:rule.id,revision:1,explanation:'200m 소요 초, 휴식은 매일 확인'});
 await assert.rejects(service.saveInterpretation(uid,mid,{id:rule.id,revision:1,explanation:'오래된 수정'}));
 await assert.rejects(service.saveInterpretation('foreign',mid,{id:rule.id,revision:2,remove:true}));
 provider=async request=>{const facts=JSON.parse(request.parts[0].text);assert.equal(facts.trainerInterpretations[0].alias,'sky erg');return {value:{answer:'200m 소요 시간 기록입니다.',references:[],questions:['휴식은 몇 초인가요?']},usage:{inputTokens:20,outputTokens:20}};};
 await service.chat(uid,mid,chatInput());provider=null;
 const other='b'.repeat(64);await db.doc(base+'/files/'+other).set({name:'새 일지.png',contentType:'image/png',size:100,status:'ready'});await service.startImport(uid,mid,other);assert.match(calls.at(-1).parts[0].text,/sky erg/);
 await service.saveInterpretation(uid,mid,{id:rule.id,revision:2,remove:true});assert.equal((await db.collection(`trainers/${uid}/interpretations`).get()).size,0);
});

test('screen capture chat works without an original, scopes member facts and stores captures separately',async()=>{
 const selection={kind:'screen',page:0,rect:{x:0,y:0,width:.5,height:.5},image:'data:image/jpeg;base64,'+Buffer.from([255,216,255,...new Array(20).fill(0)]).toString('base64')};
 provider=async request=>{const facts=JSON.parse(request.parts[0].text);assert.equal(facts.capture.kind,'screen');assert.equal(facts.records.length,0);assert.equal(request.parts[1].inlineData.mimeType,'image/jpeg');return {value:{answer:'화면에 보이는 내용을 확인해주세요.',references:[],questions:[]},usage:{inputTokens:100,outputTokens:50}};};
 const input=chatInput({fileId:'',selection});
 await assert.rejects(service.chat('foreign',mid,input));assert.equal(calls.length,0);
 await service.chat(uid,mid,input);
 const saved=(await db.doc(base+'/chats/'+input.requestId).get()).data();assert.equal(saved.status,'ready');assert.equal(saved.selection.kind,'screen');assert.ok(saved.selection.imageHash);assert.equal(saved.selection.image,undefined);assert.equal(saved.image,undefined);assert.equal((await db.doc(base+'/chatAttachments/'+input.requestId).get()).data().image,selection.image);
 const n=calls.length;await service.chat(uid,mid,input);assert.equal(calls.length,n);
});

const plainAnswer=()=>({value:{answer:'현재 기록을 확인했어요.',references:[],questions:[]},usage:{inputTokens:100,outputTokens:50}});
const resetInput=(patch={})=>({requestId:'11111111-1111-4111-a111-111111111111',chatGeneration:0,...patch});
test('new chat archives history without deleting records or captures; empty repeats create no sessions',async()=>{
 provider=async()=>plainAnswer();
 assert.equal((await service.newChat(uid,mid,resetInput())).generation,0);
 assert.equal((await db.collection(base+'/chatSessions').get()).size,0);
 const original=(await db.doc(base+'/files/'+fileId).get()).data();
 await db.doc(base+'/analysis/current').set({status:'ready',report:{headline:'유지'}});
 await service.chat(uid,mid,chatInput());
 const old=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();
 const result=await service.newChat(uid,mid,resetInput());assert.equal(result.generation,1);
 assert.equal((await service.newChat(uid,mid,resetInput())).generation,1);
 const archived=(await db.doc(base+'/chatSessions/0').get()).data();assert.equal(archived.title,chatInput().question);
 assert.deepEqual((await db.doc(base+'/chats/'+chatInput().requestId).get()).data(),old);
 assert.deepEqual((await db.doc(base+'/files/'+fileId).get()).data(),original);
 assert.equal((await db.doc(base+'/analysis/current').get()).data().report.headline,'유지');
 assert.equal((await service.newChat(uid,mid,resetInput({requestId:'22222222-2222-4222-a222-222222222222',chatGeneration:1}))).generation,1);
 assert.equal((await db.collection(base+'/chatSessions').get()).size,1);
 const count=calls.length;
 await assert.rejects(service.chat(uid,mid,chatInput({requestId:'88888888-8888-4888-a888-888888888888'})),/새 채팅/);
 await assert.rejects(service.chat(uid,mid,chatInput({requestId:'88888888-8888-4888-a888-888888888888',chatGeneration:1,previousId:chatInput().requestId})),/이전 답변/);
 assert.equal(calls.length,count);
 await service.chat(uid,mid,chatInput({requestId:'99999999-9999-4999-a999-999999999999',chatGeneration:1}));
 const fresh=(await db.doc(base+'/chats/99999999-9999-4999-a999-999999999999').get()).data();
 assert.ok(fresh.createdAt.toMillis()>archived.endAt.toMillis());
 assert.equal((await db.collection(base+'/chats').where('createdAt','>',archived.endAt).get()).size,1);
});
test('new chat refuses foreign owners, stale generation and active jobs',async()=>{
 await assert.rejects(service.newChat('other',mid,resetInput()),/회원/);
 await assert.rejects(service.newChat(uid,mid,resetInput({chatGeneration:-1})),/상태/);
 let release;const gate=new Promise(resolve=>release=resolve);
 provider=async()=>{await gate;return plainAnswer();};
 const job=service.chat(uid,mid,chatInput({fileId:''}));
 while(!calls.length)await new Promise(resolve=>setTimeout(resolve,10));
 assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().phase,'thinking');
 await assert.rejects(service.newChat(uid,mid,resetInput()),/답변이 끝난/);
 release();await job;
 assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().phase,'complete');
 await service.newChat(uid,mid,resetInput());
 await assert.rejects(service.newChat(uid,mid,resetInput({requestId:'22222222-2222-4222-a222-222222222222'})),/다른 화면/);
});
test('capture questions start with neutral thinking, not a fabricated analysis task',async()=>{
 const selection={kind:'screen',page:0,rect:{x:0,y:0,width:.5,height:.5},image:'data:image/jpeg;base64,'+Buffer.from([255,216,255,0,1,2,3,4,5,6,7,8]).toString('base64')};
 provider=async()=>{assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().phase,'thinking');return plainAnswer();};
 await service.chat(uid,mid,chatInput({fileId:'',selection}));
 assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().phase,'complete');
 await service.newChat(uid,mid,resetInput());
 assert.equal((await db.doc(base+'/chatAttachments/'+chatInput().requestId).get()).data().image,selection.image);
});

const regenerateInput=(patch={})=>({messageId:chatInput().requestId,regenerationId:'eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',revision:0,chatGeneration:0,...patch});
test('regenerate replaces one answer in place, preserves original question/capture and is idempotent',async()=>{
 const selection={kind:'screen',page:0,rect:{x:0,y:0,width:.5,height:.5},image:'data:image/jpeg;base64,'+Buffer.from([255,216,255,0,1,2,3,4,5,6,7,8]).toString('base64')};
 provider=async()=>plainAnswer();await service.chat(uid,mid,chatInput({fileId:'',selection}));
 const old=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();
 provider=async request=>{assert.equal(request.parts[1].inlineData.data,selection.image.slice(23));assert.equal(JSON.parse(request.parts[0].text).question,old.question);return {value:{answer:'새로 정리한 답변',references:[],questions:[]},usage:{inputTokens:100,outputTokens:50}};};
 await service.regenerateChat(uid,mid,regenerateInput());
 const fresh=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();
 assert.equal(fresh.answer,'새로 정리한 답변');assert.equal(fresh.revision,1);assert.deepEqual(fresh.createdAt,old.createdAt);assert.equal(fresh.selection.imageHash,old.selection.imageHash);assert.equal((await db.collection(base+'/chats').get()).size,1);
 const count=calls.length;await service.regenerateChat(uid,mid,regenerateInput());assert.equal(calls.length,count);
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput({regenerationId:'dddddddd-dddd-4ddd-addd-dddddddddddd'})),/답변이 변경/);assert.equal(calls.length,count);
});
test('failed regeneration restores the old answer and preserves failure idempotency',async()=>{
 provider=async()=>plainAnswer();await service.chat(uid,mid,chatInput({fileId:''}));
 provider=async()=>{throw Error('일시적인 모델 오류');};
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput()),/일시적인/);
 const saved=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();assert.equal(saved.status,'ready');assert.equal(saved.answer,plainAnswer().value.answer);assert.equal(saved.revision,1);assert.match(saved.regenerationError,/일시적인/);
 const count=calls.length;await assert.rejects(service.regenerateChat(uid,mid,regenerateInput()));assert.equal(calls.length,count);
 provider=async()=>plainAnswer();await service.regenerateChat(uid,mid,regenerateInput({regenerationId:'dddddddd-dddd-4ddd-addd-dddddddddddd',revision:1}));assert.equal((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().regenerationError,'');
});
test('regeneration cannot cross owners, conversations, or overlap an active regeneration',async()=>{
 provider=async()=>plainAnswer();await service.chat(uid,mid,chatInput({fileId:''}));
 await assert.rejects(service.regenerateChat('foreign',mid,regenerateInput()));
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput({chatGeneration:1})),/현재 대화/);
 let release;const gate=new Promise(resolve=>release=resolve);provider=async()=>{await gate;return plainAnswer();};
 const count=calls.length,job=service.regenerateChat(uid,mid,regenerateInput());while(calls.length===count)await new Promise(resolve=>setTimeout(resolve,10));
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput()),/다시 생성/);
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput({regenerationId:'dddddddd-dddd-4ddd-addd-dddddddddddd',revision:1})),/답변 중/);
 release();await job;await service.newChat(uid,mid,resetInput());await assert.rejects(service.regenerateChat(uid,mid,regenerateInput({regenerationId:'dddddddd-dddd-4ddd-addd-dddddddddddd',revision:1})),/새 채팅/);
});
test('legacy missing captures fail before another paid call instead of regenerating without the image',async()=>{
 provider=async()=>plainAnswer();await service.chat(uid,mid,chatInput({fileId:''}));
 await db.doc(base+'/chats/'+chatInput().requestId).update({selection:{kind:'screen',page:0,rect:{x:0,y:0,width:.5,height:.5}}});const count=calls.length;
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput()),/이전 캡처/);assert.equal(calls.length,count);
});


const publicSearchAnswer=(query='ACSM beginner resistance training guidelines')=>({value:{answer:'공개 지침을 확인할게요.',references:[],questions:[],searchDecision:'search',searchQuery:query},usage:{inputTokens:100,outputTokens:50}});
const publicWebAnswer=()=>({value:{text:'공개 지침에서 확인한 내용입니다. [웹1]',sources:[{url:'https://acsm.org',title:'ACSM'}],searchSuggestions:'<div>Google suggestions</div>'},usage:{inputTokens:100,outputTokens:50,searchQueries:2}});
test('automatic search isolates query from original question, member notes and capture',async()=>{
 await db.doc(base).update({notes:'PRIVATE HEALTH HISTORY'});
 const phases=[];provider=async req=>{phases.push((await db.doc(base+'/chats/'+chatInput().requestId).get()).data().phase);if(req.searchQuery){assert.deepEqual(Object.keys(req).sort(),['maxInputTokens','maxOutputTokens','searchQuery','timeoutMs'].sort());return publicWebAnswer();}if(req.schema?.properties?.allowed){assert.deepEqual(req.parts,[{text:'ACSM beginner resistance training guidelines'}]);return {value:{allowed:true,reason:'safe'},usage:{inputTokens:10,outputTokens:10}};}const facts=JSON.parse(req.parts[0].text);if(facts.publicResearch){assert.equal(req.searchQuery,undefined);assert.equal(facts.notes,'PRIVATE HEALTH HISTORY');assert.equal(facts.publicResearch.sources[0].title,'ACSM');return {value:{answer:'기록과 공개 지침을 함께 확인한 해석입니다. [웹1]',references:[],questions:[],searchDecision:'none',searchQuery:''},usage:{inputTokens:100,outputTokens:50}};}return publicSearchAnswer();};
 await service.chat(uid,mid,chatInput({fileId:'',question:'개인 기록 원문 PRIVATE QUESTION 공식 자료 찾아줘'}));
 const v=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();assert.match(v.answer,/기록과 공개 지침/);assert.equal(v.webSources[0].title,'ACSM');assert.equal(v.searchNotice,'');assert.deepEqual(phases,['thinking','checking_search','searching_web','composing']);assert.equal(calls.length,4);
 const usage=(await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data();assert.equal(usage.usedMicros,costMicros(100,50)*3+costMicros(10,10)+28000);assert.equal(usage.reservedMicros,0);
 const count=calls.length;await service.chat(uid,mid,chatInput({fileId:'',question:'개인 기록 원문 PRIVATE QUESTION 공식 자료 찾아줘'}));assert.equal(calls.length,count);
});
test('private and malformed queries never reach safety or search network calls',async()=>{for(const query of ['회원 A 운동 계획','a@example.com 운동',undefined]){provider=async()=>publicSearchAnswer(query);const id='testquery-'+String(calls.length).padStart(10,'0');if(query===undefined)provider=async()=>({...publicSearchAnswer(),value:{...publicSearchAnswer().value,searchQuery:null}});await service.chat(uid,mid,chatInput({fileId:'',requestId:id}));assert.ok((await db.doc(base+'/chats/'+id).get()).data().searchNotice);}assert.equal(calls.length,3);});
test('unsafe purpose and safety review rejection produce no web call',async()=>{
 provider=async()=>({...publicSearchAnswer(),value:{...publicSearchAnswer().value,searchDecision:'blocked'}});await service.chat(uid,mid,chatInput({fileId:''}));assert.equal(calls.length,1);
 provider=async req=>req.schema?.properties?.allowed?{value:{allowed:false,reason:'harmful'},usage:{inputTokens:10,outputTokens:10}}:publicSearchAnswer('스테로이드 구매 방법');await service.chat(uid,mid,chatInput({fileId:'',requestId:'rejected-query-12345678'}));assert.equal(calls.length,3);assert.ok(calls.every(c=>c.searchQuery===undefined));
});
test('search failure is visible and cannot fabricate or retain stale web sources',async()=>{
 provider=async req=>{if(req.searchQuery)throw Error('검색 서비스 일시 오류');if(req.schema?.properties?.allowed)return {value:{allowed:true,reason:'safe'},usage:{inputTokens:10,outputTokens:10}};return publicSearchAnswer();};
 await service.chat(uid,mid,chatInput({fileId:''}));const v=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();assert.equal(v.status,'ready');assert.deepEqual(v.webSources,[]);assert.equal(v.searchSuggestions,'');assert.match(v.searchNotice,/검색 서비스/);assert.match(v.answer,/이번 검색은 완료하지 못했어요/);assert.doesNotMatch(v.answer,/확인할게요/);
});
test('search fees reserve before network and use conservative charges on unknown usage',async()=>{
 service=make({...LIMITS,monthlyMicros:10000});await assert.rejects(service.paid(uid,'assistant-web-search',{searchQuery:'ACSM exercise guidelines'},100),/한도/);assert.equal(calls.length,0);
 service=make();provider=async()=>({value:{},usage:{inputTokens:10,outputTokens:10}});await service.paid(uid,'assistant-web-search',{searchQuery:'ACSM exercise guidelines'},100);const u=(await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data();assert.equal(u.usedMicros,140000+costMicros(10,10));assert.equal(u.reservedMicros,0);
});


test('failed web regeneration restores the previous grounded answer and source widget',async()=>{
 provider=async req=>req.searchQuery?publicWebAnswer():req.schema?.properties?.allowed?{value:{allowed:true,reason:'safe'},usage:{inputTokens:10,outputTokens:10}}:publicSearchAnswer();
 await service.chat(uid,mid,chatInput({fileId:''}));const old=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();
 provider=async req=>{if(req.searchQuery)throw Error('검색 일시 오류');return req.schema?.properties?.allowed?{value:{allowed:true,reason:'safe'},usage:{inputTokens:10,outputTokens:10}}:publicSearchAnswer();};
 await assert.rejects(service.regenerateChat(uid,mid,regenerateInput()),/검색 일시/);const current=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();assert.equal(current.answer,old.answer);assert.deepEqual(current.webSources,old.webSources);assert.equal(current.searchSuggestions,old.searchSuggestions);assert.match(current.regenerationError,/검색 일시/);
});


test('resume an archived conversation keeps context and new messages in its original generation',async()=>{
 provider=async()=>plainAnswer();
 const first=chatInput({fileId:'',question:'대화 A 첫 질문'});await service.chat(uid,mid,first);
 await service.newChat(uid,mid,resetInput());
 const second=chatInput({fileId:'',requestId:'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb',chatGeneration:1,question:'대화 B 첫 질문'});clock+=1000;await service.chat(uid,mid,second);
 const before=(await db.doc(base+'/chats/'+second.requestId).get()).data();
 const archived=(await db.doc(base+'/chatSessions/0').get()).data();
 provider=async req=>{const history=JSON.parse(req.parts[0].text).history;assert.equal(history.length,1);assert.equal(history[0].question,first.question);return plainAnswer();};
 const follow=chatInput({fileId:'',requestId:'cccccccc-cccc-4ccc-accc-cccccccccccc',question:'대화 A 이어서',previousId:first.requestId,resumeConversation:true});clock+=1000;
 await service.chat(uid,mid,follow);
 const saved=(await db.doc(base+'/chats/'+follow.requestId).get()).data();assert.equal(saved.generation,0);assert.equal(saved.previousId,first.requestId);assert.ok(saved.createdAt.toMillis()>archived.endAt.toMillis());
 const session=(await db.doc(base+'/chatSessions/0').get()).data();assert.deepEqual(session.legacyEndAt,archived.endAt);assert.equal(session.title,first.question);
 assert.deepEqual((await db.doc(base+'/chats/'+second.requestId).get()).data(),before);assert.equal((await db.doc(base+'/chatState/current').get()).data().generation,1);
 assert.equal((await db.collection(base+'/chats').where('generation','==',0).orderBy('createdAt','asc').get()).size,2);
 const count=calls.length;await service.chat(uid,mid,follow);assert.equal(calls.length,count);
 // A recent message in A must not hide B from the new-chat empty check.
 assert.equal((await service.newChat(uid,mid,resetInput({requestId:'dddddddd-dddd-4ddd-addd-dddddddddddd',chatGeneration:1}))).generation,2);
 assert.equal((await db.doc(base+'/chatSessions/1').get()).data().title,second.question);
 provider=async()=>plainAnswer();await service.regenerateChat(uid,mid,regenerateInput({resumeConversation:true}));
 assert.equal((await db.doc(base+'/chats/'+first.requestId).get()).data().revision,1);
});
test('resuming requires an owned, existing archived session and cannot reuse another conversation message',async()=>{
 provider=async()=>plainAnswer();await service.chat(uid,mid,chatInput({fileId:''}));await service.newChat(uid,mid,resetInput());
 const count=calls.length;
 await assert.rejects(service.chat('foreign',mid,chatInput({fileId:'',resumeConversation:true})),/회원/);
 await assert.rejects(service.chat(uid,mid,chatInput({fileId:'',chatGeneration:99,resumeConversation:true})),/새 채팅/);
 await assert.rejects(service.chat(uid,mid,chatInput({fileId:'',chatGeneration:1,resumeConversation:true})),/다른 대화/);
 await db.doc(base+'/chatSessions/0').delete();
 await assert.rejects(service.chat(uid,mid,chatInput({fileId:'',resumeConversation:true})),/새 채팅/);assert.equal(calls.length,count);
});
test('legacy messages with no generation can be resumed without rewriting or duplicating them',async()=>{
 provider=async()=>plainAnswer();const id=chatInput().requestId;
 await db.doc(base+'/chats/'+id).set({question:'예전 질문',answer:'예전 답변',status:'ready',createdAt:Timestamp.fromMillis(clock),previousId:''});
 await service.newChat(uid,mid,resetInput());
 provider=async req=>{assert.equal(JSON.parse(req.parts[0].text).history[0].answer,'예전 답변');return plainAnswer();};clock+=1000;
 await service.chat(uid,mid,chatInput({fileId:'',requestId:'ffffffff-ffff-4fff-afff-ffffffffffff',previousId:id,resumeConversation:true}));
 assert.equal((await db.doc(base+'/chats/'+id).get()).data().generation,undefined);assert.equal((await db.collection(base+'/chats').get()).size,2);
 assert.equal((await service.newChat(uid,mid,resetInput({requestId:'dddddddd-dddd-4ddd-addd-dddddddddddd',chatGeneration:1}))).generation,1);
});


test('dismissal persists without deleting records, confirming uncertain rows, revising editors or charging AI',async()=>{
 answer.records.push({...raw({rawName:'uncertain',issues:['운동명 확인']}).records[0]});
 answer.unparsed=[{page:1,text:'BB split sq LR10',reason:'좌우 횟수 확인'},{page:1,text:'sky erg 200m',reason:'단위 확인'}];
 await service.startImport(uid,mid,fileId);const before=await imported(),saved=await records(),member=(await db.doc(base).get()).data(),jobs=queued.length;
 const pending=before.rows.find(r=>r.review==='needs-review'),keys=[rowAlertKey(pending),unparsedAlertKey(before.unparsed[0])];
 await Promise.all(keys.map(alertKey=>service.reviewImport(uid,mid,fileId,{operation:'dismiss-alert',alertKey})));
 await service.reviewImport(uid,mid,fileId,{operation:'dismiss-alert',alertKey:keys[0]});
 let after=await imported();assert.deepEqual(new Set(after.dismissedReviewAlerts),new Set(keys));assert.equal(after.revision,before.revision);
 assert.deepEqual(after.rows,before.rows);assert.deepEqual(after.unparsed,before.unparsed);assert.deepEqual(await records(),saved);assert.deepEqual((await db.doc(base).get()).data(),member);
 assert.equal(visibleUnparsed(after).length,1);assert.equal(visibleUnparsed(after)[0].index,1);assert.equal(isReviewAlertVisible(after,rowAlertKey(pending)),false);
 assert.equal(calls.length,1);assert.equal(queued.length,jobs);
 await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:after.revision});
 after=await imported();assert.equal(visibleUnparsed(after).length,1);assert.equal(isReviewAlertVisible(after,rowAlertKey(after.rows.find(r=>r.id===pending.id))),false);
 assert.equal(after.rows.find(r=>r.id===pending.id).review,'needs-review');assert.equal((await records()).length,1);
});
test('dismissal rejects foreign ownership and changed warning content without dismissing a different index',async()=>{
 answer.unparsed=[{page:1,text:'first',reason:'확인'},{page:1,text:'second',reason:'확인'}];await service.startImport(uid,mid,fileId);
 const before=await imported(),key=unparsedAlertKey(before.unparsed[0]);
 await assert.rejects(service.reviewImport('foreign',mid,fileId,{operation:'dismiss-alert',alertKey:key}));
 await db.doc(base+'/imports/'+fileId).update({unparsed:[before.unparsed[1]]});
 await assert.rejects(service.reviewImport(uid,mid,fileId,{operation:'dismiss-alert',alertKey:key}),/변경/);
 await assert.rejects(service.reviewImport(uid,mid,fileId,{operation:'dismiss-alert',alertKey:'invented'}));
 const after=await imported();assert.equal(visibleUnparsed(after).length,1);assert.equal(after.dismissedReviewAlerts,undefined);assert.equal(calls.length,1);
});
test('open unparsed editor can save after its alert was dismissed',async()=>{
 answer.unparsed=[{page:1,text:'sky erg',reason:'거리 시간 확인'}];await service.startImport(uid,mid,fileId);const before=await imported();
 await service.reviewImport(uid,mid,fileId,{operation:'dismiss-alert',alertKey:unparsedAlertKey(before.unparsed[0])});
 await service.reviewImport(uid,mid,fileId,{operation:'add',rowId:'abcdefghij1234567890',unparsedIndex:0,revision:before.revision,input:{...before.rows[0].input,rawName:'sky erg',exerciseName:'스키에르그'}});
 assert.equal((await records()).length,2);assert.equal((await imported()).unparsed.length,0);assert.equal(calls.length,1);
});


test('explicit source regeneration rereads once, preserves confirmed edits and saved year',async()=>{
 await service.startImport(uid,mid,fileId);let v=await imported();await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:v.revision});v=await imported();
 await service.reviewImport(uid,mid,fileId,{operation:'row',rowId:v.rows[0].id,revision:v.revision,input:{...v.rows[0].input,exerciseName:'직접 수정',notes:'보존할 메모'}});v=await imported();const saved=await records();
 await service.startImport(uid,mid,fileId,true,{revision:v.revision});assert.equal(calls.length,2);assert.deepEqual(await records(),saved);assert.equal((await imported()).year,2025);
 await assert.rejects(service.startImport(uid,mid,fileId,true,{revision:v.revision}),/변경/);assert.equal(calls.length,2);
});
test('regeneration preserves provisional records and flags changed OCR spelling instead of double counting',async()=>{
 await service.startImport(uid,mid,fileId);const v=await imported(),saved=await records();answer=raw({rawName:'Barbell squat'});
 await service.startImport(uid,mid,fileId,true,{revision:v.revision});const next=await imported();assert.equal(next.rows.length,2);assert.equal(next.rows.filter(r=>r.review==='needs-review').length,1);assert.deepEqual(await records(),saved);assert.equal((await db.doc(base).get()).data().recordCount,1);
 await service.reviewImport(uid,mid,fileId,{operation:'year',year:2025,revision:next.revision});assert.equal((await records()).length,1);assert.equal((await imported()).rows.filter(r=>r.review==='needs-review').length,1);
});
test('failed or unowned source regeneration never removes saved records',async()=>{
 await service.startImport(uid,mid,fileId);const v=await imported(),saved=await records();
 await assert.rejects(service.startImport('foreign',mid,fileId,true,{revision:v.revision}));assert.equal(calls.length,1);
 provider=async()=>{throw Object.assign(Error('provider unavailable'),{notBillable:true});};const result=await service.startImport(uid,mid,fileId,true,{revision:v.revision});assert.ok(result.error);assert.deepEqual(await records(),saved);assert.deepEqual((await imported()).rows,v.rows);
});

// Goal persistence is server-owned and does not invoke a model.
test('training goal revisions persist atomically without AI calls',async()=>{
 const {blankTrainingGoal}=await import('../generated/training-goals.mjs');
 const input={...blankTrainingGoal(),primary:'근비대',metrics:['strength','composition']};
 await service.saveTrainingGoal(uid,mid,{input,revision:0});
 assert.equal((await db.doc(base+'/trainingGoals/current').get()).data().revision,1);
 assert.equal((await db.doc(base+'/trainingGoalHistory/1').get()).data().primary,'근비대');
 await assert.rejects(service.saveTrainingGoal(uid,mid,{input,revision:0}));
 await assert.rejects(service.saveTrainingGoal('foreign',mid,{input,revision:0}));
 await assert.rejects(service.saveTrainingGoal(uid,mid,{input:{...input,metrics:[]},revision:1}));
 await service.saveTrainingGoal(uid,mid,{input:{...input,detail:'다음 단계'},revision:1});
 assert.equal((await db.doc(base+'/trainingGoals/current').get()).data().revision,2);
 assert.equal((await db.collection(base+'/trainingGoalHistory').get()).size,2);
 assert.equal(calls.length,0);assert.equal(queued.length,1);
});

test('assessment draft uses budgeted AI, bounded context and waits for trainer save',async()=>{
 const draft={title:'마이마운틴 인터벌',purpose:'인터벌 수행 비교',steps:[{name:'운동',details:'1분 달리기'},{name:'회복',details:'시간 확인 필요'}],target:'10라운드',measures:['완료 라운드'],conditions:['동일 기기'],questions:['회복 시간은?'],metrics:['cardio'],sourceId:''};
 provider=async()=>({value:draft,usage:{inputTokens:300,outputTokens:200}});
 const result=await service.draftAssessment(uid,mid,{mode:'own',description:'1분 운동 후 회복,10라운드',answers:'',goal:'심폐체력',initialState:''});
 assert.equal(result.draft.questions.length,1);assert.equal(calls.length,1);assert.ok(calls[0].schema);assert.ok(!JSON.parse(calls[0].parts[0].text).records);
 assert.equal((await db.doc(base+'/trainingGoals/current').get()).exists,false);
 const {blankTrainingGoal}=await import('../generated/training-goals.mjs');
 const assessment={mode:'own',description:'1분 운동 후 회복,10라운드',answers:'',draft:result.draft,confirmed:false};
 await service.saveTrainingGoal(uid,mid,{input:{...blankTrainingGoal(),primary:'심폐·체력',metrics:['cardio'],assessment},revision:0});
 assert.equal((await db.doc(base+'/trainingGoals/current').get()).data().assessment.draft.title,draft.title);
 await assert.rejects(service.draftAssessment('foreign',mid,{mode:'own',description:'인터벌',answers:'',goal:'체력',initialState:''}));assert.equal(calls.length,1);
});

const flowDraft=()=>({title:'마이마운틴 인터벌',purpose:'같은 조건의 수행 비교',steps:[{name:'운동',details:'기울기20% 속도5km/h 1분'},{name:'회복',details:'기울기0% 속도3km/h 1분'}],target:'10라운드',measures:['완료 라운드'],conditions:['동일 기기'],questions:[],metrics:['cardio'],sourceId:'',fields:[{label:'완료 라운드',unit:'라운드',direction:'up',target:10}]});
const flowProposal=()=>({primary:'심폐·체력',secondary:['근비대'],detail:'동일 조건 10라운드',initialState:'6라운드',reviewAfter:4,alignment:[{goal:'심폐·체력',assessment:'완료 라운드 비교',gap:''},{goal:'근비대',assessment:'별도 측정',gap:'인터벌만으로 판단 불가'}],questions:[],assessment:flowDraft()});
async function flowGoal(){const {blankTrainingGoal}=await import('../generated/training-goals.mjs');return {...blankTrainingGoal(),primary:'심폐·체력',secondary:['근비대'],detail:'동일 조건 10라운드',initialState:'6라운드',startDate:'2026-09-01',metrics:['cardio','composition'],assessment:{mode:'own',description:'마이마운틴',answers:'',draft:flowDraft(),confirmed:true}};}
const resultRequest=(date,value,patch={})=>({goalRevision:1,revision:0,requestId:'11111111-1111-4111-a111-111111111111',input:{date,values:[value],conditions:'기울기20% 속도5km/h 운동1분 회복1분',stopReason:'',effort:null,note:''},...patch});
test('goal AI uses owned trainer principles and current member context; only trainer-approved rules generalize',async()=>{
 await db.doc('trainers/other/trainingPrinciples/secret').set({text:'다른 트레이너 기준',updatedAt:Timestamp.fromMillis(clock)});
 provider=async()=>({value:flowProposal(),usage:{inputTokens:100,outputTokens:100}});
 const {proposalId}=await service.draftGoal(uid,mid,{description:'기초체력과 근비대, 현재6라운드 목표10',answers:''});assert.equal(calls.length,1);assert.equal(JSON.parse(calls[0].parts[0].text).trainerPrinciples.length,0);
 const input={...await flowGoal(),coaching:{proposalId,reason:'체력 적응도 병행',remember:true,principle:'체력과 근비대 각각 평가. 목표 수치는 회원별 확인'}};
 await service.saveTrainingGoal(uid,mid,{input,revision:0});assert.equal((await db.doc(base+'/trainingGoalHistory/1').get()).data().aiReview.proposal.detail,flowProposal().detail);
 await db.doc(`trainers/${uid}/members/second`).set({name:'새 회원'});
 await service.draftGoal(uid,'second',{description:'근력 목표',answers:''});const facts=JSON.parse(calls.at(-1).parts[0].text);assert.equal(facts.trainerPrinciples[0].text,input.coaching.principle);assert.equal(facts.memberDecisions.length,0);assert.equal(facts.currentGoal,null);assert.equal(facts.assessmentResults.length,0);
 await service.removeTrainingPrinciple(uid,mid,{id:proposalId});await service.draftGoal(uid,'second',{description:'근력 목표',answers:''});assert.equal(JSON.parse(calls.at(-1).parts[0].text).trainerPrinciples.length,0);
 const n=calls.length;await assert.rejects(service.draftGoal('other',mid,{description:'목표',answers:''}));assert.equal(calls.length,n);
});
test('goal edits require reasons; proposal identity and revision cannot be forged',async()=>{
 provider=async()=>({value:flowProposal(),usage:{inputTokens:1,outputTokens:1}});const {proposalId}=await service.draftGoal(uid,mid,{description:'체력 목표',answers:''});const input={...await flowGoal(),detail:'8라운드로 조정',coaching:{proposalId,reason:'',remember:false,principle:''}};
 await assert.rejects(service.saveTrainingGoal(uid,mid,{input,revision:0}),/조정한 이유/);await assert.rejects(service.saveTrainingGoal(uid,mid,{input:{...input,coaching:{...input.coaching,proposalId:'22222222-2222-4222-a222-222222222222'}},revision:0}),/제안/);
 input.coaching.reason='최근 회복 상태를 먼저 확인';await service.saveTrainingGoal(uid,mid,{input,revision:0});await assert.rejects(service.saveTrainingGoal(uid,mid,{input,revision:0}));assert.equal((await service.listTrainingPrinciples(uid,mid)).principles.length,0);
 await service.draftGoal(uid,mid,{description:'다음 단계 목표',answers:''});assert.equal(JSON.parse(calls.at(-1).parts[0].text).memberDecisions[0].reason,input.coaching.reason);
});
test('assessment records persist actual values, compare conditions and reject stale or duplicate writes',async()=>{
 await service.saveTrainingGoal(uid,mid,{input:await flowGoal(),revision:0});const req=resultRequest('2026-09-01',0);await service.saveAssessmentResult(uid,mid,req);await service.saveAssessmentResult(uid,mid,req);let rows=(await db.collection(base+'/assessmentResults').get()).docs;assert.equal(rows.length,1);assert.equal(rows[0].data().values[0],0);
 await assert.rejects(service.saveAssessmentResult(uid,mid,{...req,requestId:'22222222-2222-4222-a222-222222222222'}),/기록/);
 await service.saveAssessmentResult(uid,mid,{...req,revision:1,resultId:rows[0].id,requestId:'22222222-2222-4222-a222-222222222222',input:{...req.input,values:[6]}});
 await service.saveAssessmentResult(uid,mid,{...resultRequest('2026-09-03',9),input:{...req.input,date:'2026-09-03',values:[9],conditions:'회복2분'}});assert.equal((await db.collection(base+'/assessmentResults').get()).size,2);
 await assert.rejects(service.saveAssessmentResult('other',mid,req));await assert.rejects(service.saveAssessmentResult(uid,mid,{...req,goalRevision:0}));await assert.rejects(service.saveAssessmentResult(uid,mid,{...req,input:{...req.input,values:[null]}}));
});
test('assessment AI uses matched records, caches unchanged evidence, stores trainer reasons and invalidates edits',async()=>{
 await service.saveTrainingGoal(uid,mid,{input:await flowGoal(),revision:0});await service.saveAssessmentResult(uid,mid,resultRequest('2026-09-01',6));await service.saveAssessmentResult(uid,mid,resultRequest('2026-09-03',8));await service.saveAssessmentResult(uid,mid,{...resultRequest('2026-09-05',10),input:{...resultRequest('2026-09-05',10).input,conditions:'다른 조건'}});
 const rows=(await db.collection(base+'/assessmentResults').get()).docs.map(d=>({id:d.id,...d.data()})),baseRow=rows.find(r=>r.date==='2026-09-01'),req={from:'2026-09-01',to:'2026-09-11',protocolKey:baseRow.protocolKey,conditions:baseRow.conditions};
 provider=async()=>({value:{observation:'6→8라운드',interpretation:'수행 증가, 목표10라운드 진행 중',limits:'근비대 별도 평가',nextStep:'같은 회복 조건 재확인'},usage:{inputTokens:100,outputTokens:100}});
 const a=await service.assessmentReview(uid,mid,req);assert.equal(JSON.parse(calls.at(-1).parts[0].text).records.length,2);assert.equal(JSON.parse(calls.at(-1).parts[0].text).targetApplicable,false);assert.equal(JSON.parse(calls.at(-1).parts[0].text).fields[0].target,null);await service.assessmentReview(uid,mid,req);assert.equal(calls.length,1);
 await service.saveAssessmentDecision(uid,mid,{reviewId:a.id,choice:'adjust',reason:'보행 손잡이 사용 여부부터 확인'});assert.equal((await service.assessmentReview(uid,mid,req)).decision.choice,'adjust');
 await service.saveAssessmentResult(uid,mid,{...resultRequest('2026-09-01',7),revision:1,resultId:baseRow.id,requestId:'33333333-3333-4333-a333-333333333333'});await assert.rejects(service.saveAssessmentDecision(uid,mid,{reviewId:a.id,choice:'agree',reason:'오래된 해석'}));await service.assessmentReview(uid,mid,req);assert.equal(calls.length,2);assert.equal(JSON.parse(calls.at(-1).parts[0].text).priorReviews[0].reason,'보행 손잡이 사용 여부부터 확인');
});
test('record changes during assessment generation cannot publish stale interpretation',async()=>{
 await service.saveTrainingGoal(uid,mid,{input:await flowGoal(),revision:0});await service.saveAssessmentResult(uid,mid,resultRequest('2026-09-01',6));await service.saveAssessmentResult(uid,mid,resultRequest('2026-09-03',8));const doc=(await db.collection(base+'/assessmentResults').get()).docs[0],row=doc.data();
 provider=async()=>{await doc.ref.update({revision:2});return {value:{observation:'변화',interpretation:'해석',limits:'제한',nextStep:'확인'},usage:{inputTokens:100,outputTokens:100}};};
 await assert.rejects(service.assessmentReview(uid,mid,{from:'2026-09-01',to:'2026-09-11',protocolKey:row.protocolKey,conditions:row.conditions}),/변경/);assert.equal((await db.collection(base+'/assessmentReviews').get()).size,0);
});

test('unchanged AI goal can be saved without a reason after Firestore reorders nested map keys',async()=>{
 const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>b.localeCompare(a)).map(([k,x])=>[k,reorder(x)])):v;
 provider=async()=>({value:flowProposal(),usage:{inputTokens:1,outputTokens:1}});
 const {proposalId}=await service.draftGoal(uid,mid,{description:'체력 목표',answers:''});
 await db.doc(base+'/goalProposals/'+proposalId).update({proposal:reorder(flowProposal())});
 const input={...await flowGoal(),coaching:{proposalId,reason:'',remember:false,principle:''}};
 await service.saveTrainingGoal(uid,mid,{input,revision:0});
 const history=(await db.doc(base+'/trainingGoalHistory/1').get()).data();assert.equal(history.aiReview.changed,false);
});


test('twelve uploaded files all import without a ten-file cap or nested API bounds',async()=>{
 for(let i=0;i<12;i++){
  const id=(i+1).toString(16).padStart(64,'0');
  await db.doc(base+'/files/'+id).set({name:`일지${i+1}.png`,contentType:'image/png',size:100,status:'ready'});
  await service.startImport(uid,mid,id);
  assert.equal((await db.doc(base+'/imports/'+id).get()).data().status,'ready');
 }
 assert.equal((await records()).length,12);
 assert.equal(calls.length,12);
 for(const request of calls){
  assert.equal(request.schema.properties.records.maxItems,undefined);
  assert.equal(request.schema.properties.records.items.properties.sets.maxItems,undefined);
  assert.equal(request.schema.properties.records.items.properties.components.maxItems,undefined);
 }
});


test('incline speed time extraction survives import, trainer edits and report evidence',async()=>{
 const sets=[{kg:null,reps:0,inclinePercent:20,speedKph:5,durationSeconds:60},{kg:null,reps:0,inclinePercent:0,speedKph:3,durationSeconds:60}];
 answer=raw({rawName:'마이마운틴',exerciseName:'마이마운틴',loadType:'unknown',measurementType:'incline_speed_time',sets});
 await service.startImport(uid,mid,fileId);
 assert.deepEqual((await records())[0].sets,sets);
 const data=await imported(),row=data.rows[0];
 await service.reviewImport(uid,mid,fileId,{operation:'row',revision:data.revision,rowId:row.id,rowRevision:row.revision,input:{...row.input,sets:sets.map(s=>({...s,durationSeconds:90}))},reason:'구간 시간 확인'});
 assert.equal((await records())[0].sets[0].durationSeconds,90);
 provider=async request=>{const facts=JSON.parse(request.parts[0].text);assert.equal(facts.records[0].measurementType,'incline_speed_time');assert.equal(facts.records[0].sets[0].inclinePercent,20);return {value:{judgments:judgments(facts),headline:'구간 기록',overview:'',findings:[],limitations:[],questions:[],program:[],quests:[]},usage:{inputTokens:100,outputTokens:100}};};
 await service.buildReport(uid,mid);assert.equal((await db.doc(base+'/analysis/current').get()).data().status,'ready');
});
test('trainer note travels from extraction through correction to AI facts and remains separate from OCR notes',async()=>{
 answer=raw({trainerNote:'무릎 통증 없음. 수면 부족으로 세트 축소',notes:'원본 중량 단위 kg'});
 await service.startImport(uid,mid,fileId);let v=await imported();const row=v.rows[0];
 assert.equal((await records())[0].trainerNote,answer.records[0].trainerNote);
 const trainerNote='컨디션 회복, 통증 없음';
 await service.reviewImport(uid,mid,fileId,{operation:'row',revision:v.revision,rowId:row.id,rowRevision:row.revision,recordRevision:(await records())[0].revision,input:{...row.input,trainerNote},reason:''});
 assert.equal((await records())[0].trainerNote,trainerNote);assert.equal((await imported()).rows[0].input.trainerNote,trainerNote);
 await service.buildReport(uid,mid);const facts=JSON.parse(calls.at(-1).parts[0].text);
 assert.equal(facts.records[0].trainerNote,trainerNote);assert.equal(facts.records[0].notes,'원본 중량 단위 kg');
});


test('date-level session notes persist once without an AI call and reject stale or foreign edits',async()=>{
 await service.startImport(uid,mid,fileId);const count=calls.length;
 const request={date:'2026-06-09',text:'수면 부족. 전체 운동량 조절.',revision:0};
 const saved=await service.saveSessionNote(uid,mid,request);assert.equal(saved.revision,1);assert.equal(calls.length,count);
 assert.equal((await db.doc(base+'/sessionNotes/2026-06-09').get()).data().text,request.text);
 await assert.rejects(service.saveSessionNote(uid,mid,{...request,text:'오래된 변경'}));
 await assert.rejects(service.saveSessionNote('foreign',mid,request));
 await assert.rejects(service.saveSessionNote(uid,mid,{...request,date:'2026-02-30'}));
 await assert.rejects(service.saveSessionNote(uid,mid,{...request,date:'2026-06-10'}));
 for(const text of [null,42,'x'.repeat(1001)])await assert.rejects(service.saveSessionNote(uid,mid,{...request,text,revision:1}));
 await service.buildReport(uid,mid);assert.deepEqual(JSON.parse(calls.at(-1).parts[0].text).sessionNotes,[{date:request.date,text:request.text}]);
 const previousFingerprint=(await db.doc(base+'/analysis/current').get()).data().fingerprint;
 await service.saveSessionNote(uid,mid,{...request,text:'컨디션 회복',revision:1});await service.buildReport(uid,mid);
 assert.notEqual((await db.doc(base+'/analysis/current').get()).data().fingerprint,previousFingerprint);
 await service.saveSessionNote(uid,mid,{...request,text:'',revision:2});assert.equal((await db.doc(base+'/sessionNotes/2026-06-09').get()).data().text,'');
});
test('session notes are scoped to selected chat dates and distinct from exercise observations',async()=>{
 await service.startImport(uid,mid,fileId);await service.saveSessionNote(uid,mid,{date:'2026-06-09',text:'전체 컨디션 메모',revision:0});
 await db.doc(base+'/sessionNotes/2025-01-01').set({date:'2025-01-01',text:'다른 날짜 메모',revision:1});
 provider=async request=>{const facts=JSON.parse(request.parts[0].text);assert.deepEqual(facts.sessionNotes,[{date:'2026-06-09',text:'전체 컨디션 메모'}]);return {value:{answer:'수업 메모 확인',references:[facts.records[0].id],questions:[]},usage:{inputTokens:100,outputTokens:20}};};
 await service.chat(uid,mid,chatInput());
});

test('extracted whole-class memo stays outside exercise input and manual clearing survives rereads',async()=>{
 answer=raw({sessionNote:'오늘 수면 부족',trainerNote:'스쿼트 가동 범위 조절'});await service.startImport(uid,mid,fileId);
 assert.equal((await imported()).rows[0].sessionNote,'오늘 수면 부족');assert.equal((await records())[0].trainerNote,'스쿼트 가동 범위 조절');
 await service.buildReport(uid,mid);let facts=JSON.parse(calls.at(-1).parts[0].text);assert.deepEqual(facts.sessionNotes,[{date:'2026-06-09',text:'오늘 수면 부족'}]);
 await service.saveSessionNote(uid,mid,{date:'2026-06-09',text:'',revision:0});await service.buildReport(uid,mid);facts=JSON.parse(calls.at(-1).parts[0].text);assert.deepEqual(facts.sessionNotes,[{date:'2026-06-09',text:''}]);
});


test('AI goal visuals cache matching records and keep trainer decisions attached to the current scope',async()=>{
 const {blankTrainingGoal}=await import('../generated/training-goals.mjs'),{goalVisualInputKey}=await import('../generated/goal-visual.mjs');await service.startImport(uid,mid,fileId);
 const goal={...blankTrainingGoal(),revision:1,primary:'근력',startMode:'first'};await db.doc(base+'/trainingGoals/current').set(goal);
 const normalized=async()=> (await records()).map(r=>({...r,date:r.performedAt.toDate().toISOString().slice(0,10)}));
 let key=goalVisualInputKey(await normalized(),goal,[],[],'all');
 provider=async request=>{const facts=JSON.parse(request.parts[0].text);return {value:{headline:'스쿼트 수행 근거 확인',status:'insufficient',cards:[{candidateId:facts.candidates[0].id,format:'comparison',goal:'근력',status:'insufficient',interpretation:'다른 날짜 기록 필요',nextStep:'같은 조건에서 수행 기록'}],missing:[]},usage:{inputTokens:100,outputTokens:80}};};
 const request={period:'all',inputKey:key},first=await service.goalVisual(uid,mid,request),paidCount=calls.length;assert.equal(first.cards.length,1);assert.equal((await service.goalVisual(uid,mid,request)).fingerprint,first.fingerprint);assert.equal(calls.length,paidCount);
 await service.saveGoalVisualDecision(uid,mid,{period:'all',fingerprint:first.fingerprint,choice:'agree',reason:''});assert.equal((await service.goalVisual(uid,mid,request)).decision.choice,'agree');
 await assert.rejects(service.goalVisual('foreign',mid,request));await assert.rejects(service.goalVisual(uid,mid,{...request,period:'999'}));
 const existing=(await records())[0];await db.doc(base+'/records/'+existing.id).update({revision:2,trainerNote:'컨디션 변경'});
 assert.deepEqual(await service.goalVisual(uid,mid,request),{stale:true});await assert.rejects(service.saveGoalVisualDecision(uid,mid,{period:'all',fingerprint:first.fingerprint,choice:'agree',reason:''}));
 key=goalVisualInputKey(await normalized(),goal,[],[],'all');await service.goalVisual(uid,mid,{period:'all',inputKey:key});assert.equal(calls.length,paidCount+1);
});

test('new guidance never reuses pre-guidance goal evaluations',async()=>{
 const {hash}=await import('../domain.mjs'),{blankTrainingGoal}=await import('../generated/training-goals.mjs'),{goalVisualInputKey,goalVisualCandidates}=await import('../generated/goal-visual.mjs');
 await service.startImport(uid,mid,fileId);const goal={...blankTrainingGoal(),revision:1,primary:'근력',startMode:'first'};await db.doc(base+'/trainingGoals/current').set(goal);
 const rows=(await records()).map(r=>({...r,date:r.performedAt.toDate().toISOString().slice(0,10)})),key=goalVisualInputKey(rows,goal,[],[],'all'),oldKey=JSON.stringify({...JSON.parse(key),version:'goal-visual-v2'}),c=goalVisualCandidates(rows,goal,[],[],'all').candidates[0];
 const report={headline:'기록 확인',status:'insufficient',cards:[{candidateId:c.id,format:'comparison',goal:'근력',status:'insufficient',interpretation:'과거 표현',nextStep:'기록 확인'}],missing:[]};
 await db.doc(base+'/goalVisuals/'+hash(oldKey)).set({status:'ready',inputKey:oldKey,report});
 provider=async request=>{assert.match(request.system,/ACSM2026/);return {value:report,usage:{inputTokens:100,outputTokens:100}};};const count=calls.length;
 await service.goalVisual(uid,mid,{period:'all',inputKey:key});assert.equal(calls.length,count+1);
 await service.goalVisual(uid,mid,{period:'all',inputKey:key});assert.equal(calls.length,count+1);
 assert((await db.doc(base+'/goalVisuals/'+hash(oldKey)).get()).exists);
 const logs=(await db.collection(`trainers/${uid}/aiCalls`).get()).docs.map(d=>d.data());assert(logs.some(l=>l.kind==='goal-visual'&&l.guidanceVersion==='training-guidance-2026-09-14-v2'));
});

async function lessonFixture(){
 const {blankTrainingGoal}=await import('../generated/training-goals.mjs'),{goalVisualInputKey}=await import('../generated/goal-visual.mjs');
 await service.startImport(uid,mid,fileId);const goal={...blankTrainingGoal(),revision:1,primary:'심폐·체력',startMode:'first'};await db.doc(base+'/trainingGoals/current').set(goal);
 await db.doc(base+'/records/cardio').set({exerciseName:'마이마운틴',rawName:'마이마운틴',bodyPart:'전신',loadType:'unknown',measurementType:'incline_speed_time',sets:[{kg:null,reps:0,inclinePercent:20,speedKph:5,durationSeconds:60},{kg:null,reps:0,inclinePercent:0,speedKph:3,durationSeconds:60}],performedAt:Timestamp.fromDate(new Date('2026-08-28T12:00:00Z')),revision:1,status:'confirmed',origin:'manual',notes:'',trainerNote:'오늘 컨디션 확인',sourceHash:'',sourceName:'',sourcePage:0});
 const rows=(await records()).map(r=>({...r,date:r.performedAt.toDate().toISOString().slice(0,10)}));const inputKey=goalVisualInputKey(rows,goal,[],[],'28');return {rows,goal,inputKey,period:'28'};
}
test('connected lesson shares the analysis period, preserves cardio units and makes no AI call on open',async()=>{
 const req=await lessonFixture(),count=calls.length,c=await service.lessonContext(uid,mid,req);assert.equal(calls.length,count);assert.equal(c.from,'2026-08-01');assert.equal(c.draft.source,'records');assert.equal(c.draft.items.length,1);assert.equal(c.draft.items[0].measurementType,'incline_speed_time');assert.equal(c.draft.items[0].segments[0].speedKph,5);
 provider=async request=>{const facts=JSON.parse(request.parts[0].text);assert.equal(facts.records.length,1);assert.equal(facts.records[0].trainerNote,'오늘 컨디션 확인');return {value:{title:'같은 조건의 체력 수행 확인',before:['회복 확인'],programSummary:'기존 인터벌 구성 유지',programDates:['2026-08-28'],checks:['오늘 컨디션 확인'],items:[{candidateId:'cardio',action:'review',goal:'심폐·체력',reason:'수행 조건 유지',guide:'완료 구간과 중단 이유 확인',check:'회복 구간 확인',evidenceIds:[]}]},usage:{inputTokens:100,outputTokens:100}};};
 const a=await service.generateLesson(uid,mid,{...req,basis:c.basis});assert.equal(a.draft.source,'ai');assert.equal(a.draft.items[0].segments[0].inclinePercent,20);assert.equal(a.draft.items[0].segments[1].durationSeconds,60);const paid=calls.length;await service.generateLesson(uid,mid,{...req,basis:c.basis});assert.equal(calls.length,paid);
 a.draft.items[0].rounds=10;a.draft.items[0].recoveryNote='회복 구간 포함';await service.saveConnectedLesson(uid,mid,{...req,basis:c.basis,draft:a.draft,revision:0,reason:'오늘 상태 확인 후 시행'});const saved=(await db.doc(base+'/plans/current').get()).data();assert.equal(saved.lesson.items[0].segments[0].speedKph,5);assert.equal(saved.lesson.items[0].rounds,10);assert.equal(saved.lesson.items[0].recoveryNote,'회복 구간 포함');assert.equal(saved.revision,1);assert.equal(saved.lesson.evidenceKey,c.evidenceKey);const fresh=await service.lessonContext(uid,mid,req);assert.equal(fresh.evidenceKey,c.evidenceKey);assert.notEqual(fresh.basis,c.basis);
 await assert.rejects(service.saveConnectedLesson(uid,mid,{...req,basis:c.basis,draft:a.draft,revision:0,reason:''}));await assert.rejects(service.lessonContext('foreign',mid,req));
});
test('connected lesson invalidates on trainer judgment and rejects unsupported dose and evidence',async()=>{
 const {hash}=await import('../domain.mjs');const req=await lessonFixture(),c=await service.lessonContext(uid,mid,req);
 await db.doc(base+'/goalVisualDecisions/'+hash(req.inputKey)).set({choice:'hold',reason:'회복 상태 확인'});const next=await service.lessonContext(uid,mid,req);assert.notEqual(next.evidenceKey,c.evidenceKey);assert.equal(next.decision.reason,'회복 상태 확인');assert.deepEqual(await service.generateLesson(uid,mid,{...req,basis:c.basis}),{stale:true});
 const bad=structuredClone(next.draft);bad.items[0].segments[0].speedKph=-1;await assert.rejects(service.saveConnectedLesson(uid,mid,{...req,basis:next.basis,draft:bad,revision:0,reason:''}));
 provider=async()=>({value:{title:'잘못된 근거',checks:[],items:[{candidateId:'invented',action:'keep',goal:'체력',reason:'',guide:'',check:'',evidenceIds:[]}]},usage:{inputTokens:100,outputTokens:100}});await assert.rejects(service.generateLesson(uid,mid,{...req,basis:next.basis}));assert.equal((await service.lessonContext(uid,mid,req)).draft.source,'records');
});
test('connected lesson does not replace a saved plan when new records arrive',async()=>{
 const req=await lessonFixture();await db.doc(base+'/plans/current').set({program:[{exerciseName:'기존 수업',sets:2,reps:'8회',loadGuide:'',reason:'',recordId:''}],reason:'트레이너 메모',revision:1,basedOn:'old'});const c=await service.lessonContext(uid,mid,req);assert.equal(c.draft.items[0].exerciseName,'마이마운틴');assert.equal((await db.doc(base+'/plans/current').get()).data().program[0].exerciseName,'기존 수업');assert.equal((await db.doc(base+'/plans/current').get()).data().reason,'트레이너 메모');
 await db.doc(base+'/records/cardio').update({revision:2});assert.deepEqual(await service.lessonContext(uid,mid,req),{stale:true});await assert.rejects(service.saveConnectedLesson(uid,mid,{...req,basis:c.basis,draft:c.draft,revision:1,reason:''}));
});

test('connected lesson recovers from a cached quota failure without losing context or blocking retry',async()=>{
 const req=await lessonFixture(),initial=await service.lessonContext(uid,mid,req),count=calls.length;
 service=make({...LIMITS,dailyCalls:0});
 await assert.rejects(service.generateLesson(uid,mid,{...req,basis:initial.basis}),/AI_USAGE_LIMIT/);
 service=make();
 const recovered=await service.lessonContext(uid,mid,req);
 // callAi throws for top-level error; a cached generation failure must not fail a successful read.
 assert.equal(recovered.error,undefined);assert.equal(recovered.status,'error');assert.ok(recovered.generationError);
 assert.equal(recovered.draft.source,'records');assert.equal(recovered.draft.items[0].exerciseName,'마이마운틴');assert.equal(calls.length,count);
 provider=async()=>({value:{title:'체력 수행 확인',before:['회복 확인'],programSummary:'기존 인터벌 구성 유지',programDates:['2026-08-28'],checks:[],items:[{candidateId:'cardio',action:'keep',goal:'심폐·체력',reason:'최근 수행 근거',guide:'같은 조건 확인',check:'회복 확인',evidenceIds:[]}]},usage:{inputTokens:100,outputTokens:100}});
 const ready=await service.generateLesson(uid,mid,{...req,basis:recovered.basis});
 assert.equal(ready.status,'ready');assert.equal(ready.draft.source,'ai');assert.equal(ready.generationError,'');assert.equal(calls.length,count+1);
});

test('lesson AI payload removes duplicate presentation data while retaining every source record and condition',async()=>{
 const {lessonFacts}=await import('../lesson-planning.mjs');
 const req=await lessonFixture(),c=await service.lessonContext(uid,mid,req),point={date:'2026-08-28',value:20,recordIds:req.rows.map(r=>r.id),condition:'경사20% 속도5km/h',notes:['무릎 불편감']};
 const s={...c,goal:req.goal,rows:req.rows,notes:[{date:point.date,text:'컨디션 확인'}],memory:{currentGoal:req.goal,trainerPrinciples:[{text:'같은 조건 비교'}],memberDecisions:[{reason:'회복 확인'}],assessmentResults:[],assessmentDecisions:[]},plan:{lesson:{...c.draft,inputKey:'large internal fingerprint'},reason:'트레이너 조정'},memberNotes:'수업 전 확인',goalReview:{headline:'판단 보류'},decision:{choice:'hold',reason:'기록 필요'},visuals:[{id:'body',name:'부위 비중',kind:'distribution',unit:'%',target:null,direction:'observe',conditionsMatch:true,points:[point]}]};
 const facts=lessonFacts(s);
 assert.equal(facts.records.length,req.rows.length);assert.deepEqual(facts.records.map(r=>r.sets),req.rows.map(r=>r.sets));
 assert.deepEqual(facts.sessionNotes,s.notes);assert.deepEqual(facts.trainerDecision,s.decision);assert.deepEqual(facts.memory.memberDecisions,s.memory.memberDecisions);
 assert.equal(facts.memory.currentGoal,undefined);assert.equal(facts.savedPlan.inputKey,undefined);assert.equal(facts.savedPlan.items[0].evidence,undefined);
 assert.equal(facts.savedPlan.reason,'트레이너 조정');assert.equal(facts.candidates[0].segments,undefined);assert.equal(facts.candidates[0].recordId,c.candidates[0].recordId);
 assert.equal(facts.visuals[0].points.length,1);assert.equal(facts.visuals[0].points[0].recordIds,undefined);assert.deepEqual(facts.visuals[0].points[0].notes,point.notes);assert.equal(facts.visuals[0].points[0].condition,point.condition);
});

test('next lesson begins with the whole original program and AI receives session order beyond goal cards',async()=>{
 const {goalVisualInputKey}=await import('../generated/goal-visual.mjs'),{hash}=await import('../domain.mjs');
 const req=await lessonFixture(),ordered=['cardio',...Array.from({length:7},(_,i)=>'program-'+(7-i))];
 for(const [i,id]of ordered.entries())if(id!=='cardio')await db.doc(base+'/records/'+id).set({exerciseName:'프로그램 운동 '+i,rawName:'프로그램 운동 '+i,bodyPart:i%2?'하체':'등',loadType:'weighted',measurementType:'repetitions',sets:[{kg:20,reps:10}],performedAt:Timestamp.fromDate(new Date('2026-08-28T12:00:00Z')),revision:1,status:'confirmed',origin:'manual',notes:'',sourceHash:fileId,sourceName:'원본 일지',sourcePage:1});
 await db.doc(base+'/records/cardio').update({sourceHash:fileId,sourceName:'원본 일지',sourcePage:1});
 const imp=await db.doc(base+'/imports/'+fileId).get();await imp.ref.update({rows:[...imp.data().rows,...ordered.map(id=>({id,review:'confirmed',input:{date:'2026-08-28'}}))]});
 const rows=(await records()).map(r=>({...r,date:r.performedAt.toDate().toISOString().slice(0,10)}));req.inputKey=goalVisualInputKey(rows,req.goal,[],[],'28');
 await db.doc(base+'/goalVisuals/'+hash(req.inputKey)).set({status:'ready',report:{headline:'심폐 평가 확인',cards:[{candidateId:'summary-sets',goal:'체력',interpretation:'평가 참고',nextStep:'확인'}]}});
 const c=await service.lessonContext(uid,mid,req);assert.equal(c.draft.items.length,8);assert.deepEqual(c.draft.items.map(i=>i.id),ordered);assert.equal(c.history.sessions.length,1);
 let lessonCalls=0;provider=async request=>{lessonCalls++;const facts=JSON.parse(request.parts[0].text);assert.equal(facts.records.length,8);assert.deepEqual(facts.programHistory.sessions[0].blocks[0].recordIndexes.map(i=>facts.records[i-1].id),ordered);assert.deepEqual(facts.programHistory.sessions[0].blocks[0].exerciseNames,ordered.map(id=>facts.records.find(r=>r.id===id).exerciseName));assert.ok(facts.candidates.every(c=>c.exerciseName));assert.equal(facts.programHistory.patterns.sessionCount,1);return {value:{title:'기존 전신 구성 유지',before:['회복 상태 확인'],programSummary:'기존 인터벌과 근력 운동의 구성·순서 유지',programDates:['2026-08-28'],checks:['수행 결과 기록'],items:c.draft.items.map(i=>({candidateId:i.id,action:'keep',goal:'기초 체력',reason:'기존 프로그램 유지',guide:'같은 조건 확인',check:'수행 기록',evidenceIds:[]}))},usage:{inputTokens:100,outputTokens:100}};};
 const generated=await service.generateLesson(uid,mid,{...req,basis:c.basis});assert.equal(generated.draft.items.length,8);const cached=await service.generateLesson(uid,mid,{...req,basis:c.basis});assert.deepEqual(cached.draft,generated.draft);assert.equal(lessonCalls,1);const renewed=await service.generateLesson(uid,mid,{...req,basis:c.basis,retry:true});assert.equal(renewed.status,'ready');assert.equal(lessonCalls,2);assert.deepEqual(generated.draft.programDates,['2026-08-28']);
 await service.saveConnectedLesson(uid,mid,{...req,basis:c.basis,draft:generated.draft,revision:0,reason:'기존 구성 확인'});const saved=(await db.doc(base+'/plans/current').get()).data();assert.equal(saved.lesson.before[0],'회복 상태 확인');assert.equal(saved.lesson.programSummary,generated.draft.programSummary);
 const current=await service.lessonContext(uid,mid,req);const oldRows=(await imp.ref.get()).data().rows;await imp.ref.update({rows:[...oldRows].reverse()});
 const reordered=await service.lessonContext(uid,mid,req);assert.notEqual(reordered.basis,current.basis);await assert.rejects(service.saveConnectedLesson(uid,mid,{...req,basis:current.basis,draft:current.draft,revision:1,reason:''}),/근거/);
 const {validateLesson}=await import('../lesson-planning.mjs');assert.throws(()=>validateLesson({title:'오류',before:[],programSummary:'가짜',programDates:['1999-01-01'],checks:[],items:[{}]},{...c,history:c.history}),/형식|참고/);
});


test('screen chat sends compact summary, full records and image once without an extra AI call',async()=>{
 await service.startImport(uid,mid,fileId);
 const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,...new Array(20).fill(0)]).toString('base64');
 const selection={kind:'screen',page:0,rect:{x:0,y:0,width:.5,height:.5},image};
 const before=calls.length;
 provider=async request=>{
  const facts=JSON.parse(request.parts[0].text);
  assert.equal(facts.records.length,1);assert.equal(facts.records[0].sets[1].kg,60);
  assert.equal(facts.summary.exerciseTrends,undefined);
  assert.ok(facts.summary.exerciseLoadContext.columns.includes('days'));
  assert.equal(facts.capture.image,undefined);
  assert.equal(request.parts.length,2);assert.equal(request.parts[1].inlineData.data,image.slice(23));
  assert.match(request.system,/columns,rows/);
  return {value:{answer:'기록과 캡처를 함께 확인했어요.',references:[facts.records[0].id],questions:[]},usage:{inputTokens:100,outputTokens:30}};
 };
 await service.chat(uid,mid,chatInput({fileId:'',selection}));
 assert.equal(calls.length,before+1);
 assert.equal((await db.doc(base+'/chatAttachments/'+chatInput().requestId).get()).data().image,image);
});


test('assistant context budget is separate and reserves the same ceiling passed to the model',async()=>{
 provider=async request=>{
  const usage=(await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data();
  assert.equal(usage.reservedMicros,costMicros(request.maxInputTokens,100));
  return {value:{},usage:{inputTokens:100,outputTokens:20}};
 };
 await service.paid(uid,'assistant-chat',{system:'test',parts:[{text:'synthetic'}]},100);
 assert.equal(calls.at(-1).maxInputTokens,65536);
 await service.paid(uid,'analysis-and-plan',{system:'test',parts:[{text:'synthetic'}]},100);
 assert.equal(calls.at(-1).maxInputTokens,LIMITS.maxInputTokens);
 service=make({...LIMITS,chatInputTokens:48000});
 await service.paid(uid,'assistant-chat',{system:'test',parts:[{text:'synthetic'}]},100);
 assert.equal(calls.at(-1).maxInputTokens,48000);
 assert.equal((await db.doc(`trainers/${uid}/aiUsage/2026-09`).get()).data().reservedMicros,0);
});

test('search capability question answers accurately without model or public search calls',async()=>{
 await service.chat(uid,mid,chatInput({fileId:'',question:'웹에서 검색할수가 없는거야?'}));
 const v=(await db.doc(base+'/chats/'+chatInput().requestId).get()).data();
 assert.equal(calls.length,0);assert.equal(v.status,'ready');assert.equal(v.searchDecision,'none');assert.equal(v.searchNotice,'');assert.deepEqual(v.webSources,[]);assert.deepEqual(v.references,[]);assert.match(v.answer,/웹 검색을 사용할 수 있어요/);assert.equal(v.usage,null);
});
