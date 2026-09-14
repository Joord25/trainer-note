import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createService} from '../service.mjs';
import {LIMITS,costMicros} from '../domain.mjs';

test('1000 synthetic accounts settle correctly with 40 concurrent accounting requests',{skip:process.env.TN_CAPACITY_TEST!=='1'},async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required; no live load tests');
 const app=initializeApp({projectId:'demo-trainer-note'},'capacity-test'),db=getFirestore(app);
 try{
  const response=await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-trainer-note/databases/(default)/documents`,{method:'DELETE'});assert.ok(response.ok);
  let next=0,modelCalls=0;const durations=[],started=performance.now();
  const service=createService({db,limits:LIMITS,now:()=>Date.parse('2026-09-14T00:00:00Z'),readSource:async()=>{throw Error('not used');},enqueue:async()=>{},model:async()=>{modelCalls++;return {value:{},usage:{inputTokens:1000,outputTokens:300}};}});
  await Promise.all(Array.from({length:40},async()=>{while(next<1000){const id=next++,start=performance.now();await service.paid(`capacity-${id}`,'test',{},500);durations.push(performance.now()-start);}}));
  assert.equal(modelCalls,1000);assert.equal(durations.length,1000);
  const shards=await db.collection('aiGlobalUsage/2026-09/shards').get();
  assert.equal(shards.docs.reduce((n,d)=>n+(d.data().usedMicros||0),0),1000*costMicros(1000,300));
  assert.equal(shards.docs.reduce((n,d)=>n+(d.data().reservedMicros||0),0),0);
  assert.equal((await db.doc('aiGlobalUsage/2026-09').get()).exists,false);
  for(let offset=0;offset<1000;offset+=40){const accounts=await db.getAll(...Array.from({length:40},(_,i)=>db.doc(`trainers/capacity-${offset+i}/aiUsage/2026-09`)));assert.ok(accounts.every(d=>d.data()?.calls===1&&d.data()?.usedMicros===costMicros(1000,300)&&d.data()?.reservedMicros===0));}
  durations.sort((a,b)=>a-b);console.log(JSON.stringify({test:'emulator-accounting-only',accounts:1000,concurrency:40,model:'mock',elapsedMs:Math.round(performance.now()-started),p95Ms:Math.round(durations[949]),shards:shards.size}));
 }finally{await deleteApp(app);}
});
