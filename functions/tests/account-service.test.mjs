import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createAccountService} from '../account-service.mjs';
let app,db,service,clock,users,jobs,removed;
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'account-tests');db=getFirestore(app);});
after(()=>deleteApp(app));
beforeEach(async()=>{await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-trainer-note/databases/(default)/documents`,{method:'DELETE'});clock=Date.parse('2026-09-14T00:00:00Z');users=new Set(['owner','other']);jobs=[];removed=[];service=createAccountService({db,now:()=>clock,auth:{getUser:async uid=>{if(!users.has(uid))throw Object.assign(Error('missing'),{code:'auth/user-not-found'});return {uid};},deleteUser:async uid=>{users.delete(uid);}},bucket:{deleteFiles:async options=>removed.push(options)},enqueue:async(data,delay,id)=>jobs.push({data,delay,id})});});
test('deletion requires recent explicit confirmation and rejects foreign paths',async()=>{for(const data of [{confirmed:false,authTime:clock/1000},{confirmed:true,authTime:clock/1000-301},{confirmed:true,authTime:NaN}])await assert.rejects(service.deleteAccount('owner',data));await assert.rejects(service.deleteAccount('../other',{confirmed:true,authTime:clock/1000}));assert.equal((await db.collection('accountDeletions').get()).size,0);});
test('deletion blocks immediately then removes only owned nested data and objects after active jobs drain',async()=>{
 await db.doc('trainers/owner/members/m/records/r').set({value:'private'});await db.doc('trainers/owner/feedback/f').set({message:'feedback'});await db.doc('trainers/other/members/m').set({keep:true});
 await service.deleteAccount('owner',{confirmed:true,authTime:clock/1000});assert.equal(users.has('owner'),false);assert.equal(jobs[0].delay,210);await assert.rejects(service.active('owner'));await assert.rejects(service.finishDeletion({uid:'owner',phase:'purge'}));
 clock+=211000;await service.finishDeletion({uid:'owner',phase:'purge'});assert.deepEqual(removed,[{prefix:'trainers/owner/',force:true}]);assert.equal((await db.doc('trainers/owner/members/m/records/r').get()).exists,false);assert.equal((await db.doc('trainers/owner/feedback/f').get()).exists,false);assert.equal((await db.doc('trainers/other/members/m').get()).exists,true);assert.equal(users.has('other'),true);
 await assert.rejects(service.finishDeletion({uid:'owner',phase:'release'}));clock+=3900000;await service.finishDeletion({uid:'owner',phase:'release'});assert.equal((await db.doc('accountDeletions/owner').get()).exists,false);
});
test('failed deletion cleanup retains lock and retries without touching another owner',async()=>{service=createAccountService({db,now:()=>clock,auth:{deleteUser:async()=>{}},bucket:{deleteFiles:async()=>{throw Error('temporary failure');}},enqueue:async()=>{}});await service.deleteAccount('owner',{confirmed:true,authTime:clock/1000});clock+=211000;await assert.rejects(service.finishDeletion({uid:'owner',phase:'purge'}));assert.equal((await db.doc('accountDeletions/owner').get()).data().status,'pending');});
test('feedback is owned, bounded, idempotent and rate limited without copying records',async()=>{
 const data={requestId:'feedback-request-001',topic:'AI 도우미',message:'설명이 불명확해요',contact:''};
 await service.feedback('owner',data);await service.feedback('owner',data);const rows=await db.collection('trainers/owner/feedback').get();assert.equal(rows.size,1);assert.deepEqual(Object.keys(rows.docs[0].data()).sort(),['contact','createdAt','message','status','topic']);await assert.rejects(service.feedback('owner',{...data,requestId:'feedback-request-002'}));clock+=31000;await service.feedback('owner',{...data,requestId:'feedback-request-002'});await assert.rejects(service.feedback('owner',{...data,requestId:'../foreign'}));
});
