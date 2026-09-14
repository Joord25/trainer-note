import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createRequestGuard} from '../request-guard.mjs';
let app,db,now,guard;
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'request-guard-tests');db=getFirestore(app);});
after(()=>deleteApp(app));
beforeEach(async()=>{await db.recursiveDelete(db.doc('trainers/guard-test'));await db.doc('accountDeletions/guard-test').delete();now=1000000;guard=createRequestGuard({db,now:()=>now});});
test('concurrent requests share an atomic per-account limit and other accounts remain independent',async()=>{
 const results=await Promise.allSettled(Array.from({length:8},()=>guard.acquire('guard-test')));
 const accepted=results.filter(r=>r.status==='fulfilled');assert.equal(accepted.length,4);
 assert.ok(results.filter(r=>r.status==='rejected').every(r=>r.reason.code==='resource-exhausted'));
 const other=await guard.acquire('other-guard-test');await other();await Promise.all(accepted.map(r=>r.value()));
 const release=await guard.acquire('guard-test');await release();await release();
 assert.deepEqual((await db.doc('trainers/guard-test/requestGuards/trainerAi').get()).data().active,{});
});
test('burst limit refills over time without a daily allowance',async()=>{
 for(let i=0;i<20;i++){const release=await guard.acquire('guard-test');await release();}
 await assert.rejects(guard.acquire('guard-test'),e=>e.code==='resource-exhausted');now+=1000;
 const release=await guard.acquire('guard-test');await release();now+=86400000;
 const tomorrow=await guard.acquire('guard-test');await tomorrow();
});
test('timed-out invocations expire and a late release cannot remove newer leases',async()=>{
 const old=await Promise.all(Array.from({length:4},()=>guard.acquire('guard-test')));now+=190001;
 const fresh=await guard.acquire('guard-test');await Promise.all(old.map(release=>release()));
 assert.equal(Object.keys((await db.doc('trainers/guard-test/requestGuards/trainerAi').get()).data().active).length,1);await fresh();
});
test('deletion lock denies new work and release never recreates deleted account documents',async()=>{
 const release=await guard.acquire('guard-test');await db.doc('accountDeletions/guard-test').set({status:'pending'});
 await assert.rejects(guard.acquire('guard-test'),e=>e.code==='permission-denied');
 await db.recursiveDelete(db.doc('trainers/guard-test'));await release();
 assert.equal((await db.doc('trainers/guard-test/requestGuards/trainerAi').get()).exists,false);
});
