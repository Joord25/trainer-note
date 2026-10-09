import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createUsageReporting,summarizeUsage,usageMonth} from '../usage-report.mjs';

test('cost totals distinguish pending, failed, unknown usage and legacy purpose',()=>{
 const calls=[
  {kind:'extraction',purpose:'production',status:'complete',estimatedMicros:100,inputTokens:80,outputTokens:20,durationMs:1000},
  {kind:'extraction',purpose:'development',status:'failed',estimatedMicros:300,usageUncertain:true,durationMs:3000},
  {kind:'assistant-chat',model:'gemini-3.5-flash-lite',status:'complete',estimatedMicros:200,inputTokens:100,outputTokens:30},
  {kind:'extraction',purpose:'production',status:'reserved',reservedMicros:900},
  {kind:'search-safety',purpose:'production',status:'failed',estimatedMicros:0,durationMs:0},
  {kind:'assistant-web-search',purpose:'production',status:'complete',estimatedMicros:400,searchEstimatedMicros:350},
 ];
 const summary=summarizeUsage(calls);
 assert.equal(summary.totals.usedMicros,1000);assert.equal(summary.totals.reservedMicros,900);assert.equal(summary.totals.averageMicros,200);assert.equal(summary.totals.settledCalls,5);assert.equal(summary.totals.failedCalls,2);assert.equal(summary.totals.uncertainCalls,1);assert.equal(summary.totals.uncertainMicros,300);assert.equal(summary.totals.searchMicros,350);assert.equal(summary.totals.averageDurationMs,4000/3);
 assert.equal(summary.sources.unclassified.usedMicros,200);assert.equal(summary.sources.development.usedMicros,300);
 assert.equal(summary.rows.find(r=>r.id==='chat-deep').label,'AI 도우미 · 심층');assert.equal(summary.rows.find(r=>r.id==='extraction').averageMicros,200);
 const prod=summarizeUsage(calls,{purpose:'production'});assert.equal(prod.totals.usedMicros,500);assert.equal(prod.rows.find(r=>r.id==='extraction').settledCalls,1);
 assert.equal(summarizeUsage([]).totals.averageMicros,null);assert.equal(summarizeUsage([{status:'reserved'}]).totals.averageMicros,null);
});
test('month boundaries use Korea time',()=>{assert.equal(usageMonth(Date.parse('2026-09-30T14:59:59Z')),'2026-09');assert.equal(usageMonth(Date.parse('2026-09-30T15:00:00Z')),'2026-10');});
let db,app;const uid='usage-owner',now=()=>Date.parse('2026-10-10T10:00:00Z');
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'usage-report');db=getFirestore(app);});
after(async()=>deleteApp(app));
beforeEach(async()=>{const response=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-trainer-note/databases/(default)/documents`,{method:'DELETE'});assert.ok(response.ok);});
const write=async(id,data,owner=uid)=>db.doc(`trainers/${owner}/aiCalls/${id}`).set({month:'2026-10',kind:'extraction',status:'complete',estimatedMicros:100,...data});
test('report is scoped to authenticated owner and month and exposes no raw records',async()=>{
 await write('one',{model:'private-provider',prompt:'private prompt',memberId:'private-member'});await write('two',{month:'2026-09',estimatedMicros:9999});await write('foreign',{estimatedMicros:90000},'someone-else');await db.doc(`trainers/${uid}/aiUsage/2026-10`).set({calls:2,usedMicros:150});
 const service=createUsageReporting({db,now}),result=await service.report(uid,{month:'2026-10',uid:'someone-else'});
 assert.equal(result.totals.calls,1);assert.equal(result.totals.usedMicros,100);assert.equal(result.unattributedMicros,50);assert.equal(result.unattributedCalls,1);assert.equal(result.breakdowns.unclassified.totals.calls,1);assert.equal(result.breakdowns.production.totals.calls,0);assert.equal(result.trackingPurpose,'production');assert.ok(!/private|someone-else|90000/.test(JSON.stringify(result)));
 for(const month of ['2026-13','2026-11','2024-10','../other'])await assert.rejects(()=>service.report(uid,{month}));await assert.rejects(()=>service.report(uid,{purpose:'arbitrary'}));
});
test('large reports are explicitly partial and missing history never becomes zero cost',async()=>{
 for(let i=0;i<3;i++)await write(String(i),{});await db.doc(`trainers/${uid}/aiUsage/2026-10`).set({calls:3,usedMicros:300});
 const result=await createUsageReporting({db,now,limit:2}).report(uid,{});assert.equal(result.partial,true);assert.equal(result.scannedCalls,2);assert.equal(result.monthly.usedMicros,300);assert.equal(result.unattributedMicros,100);
 const absent=await createUsageReporting({db,now}).report(uid,{month:'2026-09'});assert.equal(absent.totals.averageMicros,null);
});
test('purpose setting affects only owner future tracking and leaves old calls unchanged',async()=>{
 await write('legacy',{});const service=createUsageReporting({db,now});await service.setPurpose(uid,{purpose:'development',uid:'someone-else'});
 assert.equal((await service.report(uid,{})).trackingPurpose,'development');assert.equal((await service.report(uid,{})).sources.unclassified.calls,1);assert.equal((await db.doc('trainers/someone-else/usageSettings/current').get()).exists,false);
 await assert.rejects(()=>service.setPurpose(uid,{purpose:'all'}));
});

test('project report aggregates accounts and reconciles legacy plus sharded ledger',async()=>{
 await write('one',{estimatedMicros:100});await write('two',{estimatedMicros:300},'second-owner');await write('past',{month:'2026-09',estimatedMicros:999},'second-owner');
 await db.doc('aiGlobalUsage/2026-10').set({usedMicros:100,reservedMicros:10});await db.doc('aiGlobalUsage/2026-10/shards/01').set({usedMicros:350,reservedMicros:20});
 await db.doc('unrelated/a/aiCalls/x').set({month:'2026-10',estimatedMicros:10000,status:'complete'});
 const result=await createUsageReporting({db,now}).report(uid,{month:'2026-10'},{project:true});
 assert.equal(result.scope,'project');assert.equal(result.totals.usedMicros,400);assert.equal(result.totals.calls,2);assert.equal(result.monthly.usedMicros,450);assert.equal(result.monthly.reservedMicros,30);assert.equal(result.monthly.calls,null);assert.equal(result.unattributedMicros,50);assert.ok(!JSON.stringify(result).includes('second-owner'));
});

test('usage access fails closed, rejects forged identity, and revokes without a new token',async()=>{
 const {createUsageAccess}=await import('../usage-access.mjs');let reads=0,writes=0;
 const access=createUsageAccess({db,reporting:{report:async(owner,data,options)=>{reads++;assert.equal(owner,uid);assert.equal(options.project,true);return {ok:true};},setPurpose:async owner=>{writes++;assert.equal(owner,uid);return {ok:true};}}});
 const admin={uid,token:{email_verified:true}},ordinary={uid:'other',token:{email_verified:true,admin:true}};
 await assert.rejects(()=>access(null,{action:'report'}),{code:'unauthenticated'});
 assert.deepEqual(await access(admin,{action:'access'}),{admin:false});
 await db.doc('systemAccess/billing').set({uids:[uid]});
 assert.deepEqual(await access(admin,{action:'access'}),{admin:true});
 for(const actor of [ordinary,{...admin,token:{email_verified:false}}])for(const action of ['report','setPurpose'])await assert.rejects(()=>access(actor,{action,uid,admin:true}),{code:'permission-denied'});
 assert.equal(reads,0);assert.equal(writes,0);
 await access(admin,{action:'report'});await access(admin,{action:'setPurpose',uid:'other'});assert.equal(reads,1);assert.equal(writes,1);
 await db.doc('systemAccess/billing').set({uids:[]});await assert.rejects(()=>access(admin,{action:'report'}),{code:'permission-denied'});
});
