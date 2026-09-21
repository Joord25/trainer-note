import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createSourceManagement} from '../source-management.mjs';
let app,db,manage,removed,fail;
const fileId='a'.repeat(64),otherId='b'.repeat(64),base='trainers/source-test/members/member';
const req=(operation,extra={})=>manage('source-test','member',{fileId,operation,...extra});
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'source-management-test');db=getFirestore(app);});
after(()=>deleteApp(app));
beforeEach(async()=>{
 await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-trainer-note/databases/(default)/documents`,{method:'DELETE'});
 removed=[];fail=false;manage=createSourceManagement({db,bucket:{file:path=>({delete:async()=>{if(fail)throw Error('storage failure');removed.push(path);}})}});
 await db.doc(base).set({fileCount:2,recordCount:3});
 for(const id of [fileId,otherId])await db.doc(base+'/files/'+id).set({status:'ready',name:'original.png',contentType:'image/png'});
 await db.doc(base+'/imports/'+fileId).set({status:'ready',revision:1,rows:[{id:'r1',review:'confirmed'},{id:'r2',review:'confirmed'}],unparsed:[]});
 for(const id of ['r1','r2','other'])await db.doc(base+'/records/'+id).set({sourceHash:id==='other'?otherId:fileId,status:'confirmed',sourceName:'original.png'});
});
test('rename preserves source identity and other owners cannot mutate it',async()=>{
 await req('rename',{name:'new.png'});const f=(await db.doc(base+'/files/'+fileId).get()).data();assert.equal(f.name,'original.png');assert.equal(f.displayName,'new.png');
 await assert.rejects(manage('foreign','member',{fileId,operation:'delete'}));await assert.rejects(req('rename',{name:' '}));assert.equal(removed.length,0);
});
test('archive removes only bytes and keeps import, records and counts',async()=>{
 await req('archive');const f=(await db.doc(base+'/files/'+fileId).get()).data();assert.equal(f.originalRemoved,true);assert.equal(f.status,'ready');
 assert.equal((await db.collection(base+'/records').get()).size,3);assert.equal((await db.doc(base+'/imports/'+fileId).get()).exists,true);assert.equal((await db.doc(base).get()).data().recordCount,3);assert.equal(removed.length,1);
});
test('archive allows unreviewed non-workout documents and preserves every saved draft',async()=>{
 const imp=db.doc(base+'/imports/'+fileId);
 await imp.update({unparsed:[{text:'가입신청서'}],rows:[{id:'r1',review:'needs-review'}]});
 await db.doc(base+'/records/r1').update({status:'provisional'});
 const before=(await imp.get()).data();await req('archive');
 assert.deepEqual((await imp.get()).data(),before);assert.equal((await db.doc(base+'/records/r1').get()).data().status,'provisional');assert.equal(removed.length,1);
});
test('archive accepts failed or missing interpretation, but processing remains protected',async()=>{
 await db.doc(base+'/imports/'+fileId).update({status:'processing'});
 await assert.rejects(req('archive'),/판독/);await assert.rejects(req('delete'),/판독/);assert.equal(removed.length,0);
 await db.doc(base+'/imports/'+fileId).update({status:'error'});await req('archive');
 await db.doc(base+'/imports/'+otherId).delete();await manage('source-test','member',{fileId:otherId,operation:'archive'});assert.equal(removed.length,2);
});
test('failed storage cleanup remains retryable and never prematurely removes data',async()=>{
 fail=true;await assert.rejects(req('delete'),/storage failure/);assert.equal((await db.doc(base+'/files/'+fileId).get()).data().status,'deleting');assert.equal((await db.collection(base+'/records').get()).size,3);
 fail=false;await req('delete');assert.equal((await db.doc(base+'/files/'+fileId).get()).exists,false);assert.equal((await db.doc(base+'/imports/'+fileId).get()).exists,false);assert.equal((await db.collection(base+'/records').get()).size,1);
 const m=(await db.doc(base).get()).data();assert.equal(m.fileCount,1);assert.equal(m.recordCount,1);assert.ok(removed.every(p=>p.startsWith(base+'/files/'+fileId+'/')));
});
test('large deletion spans batches without removing another source',async()=>{
 const writer=db.bulkWriter();for(let n=0;n<510;n++)writer.set(db.doc(base+'/records/extra'+n),{sourceHash:fileId,status:'confirmed'});await writer.close();await db.doc(base).update({recordCount:513});await req('delete');assert.equal((await db.collection(base+'/records').get()).size,1);assert.equal((await db.doc(base).get()).data().recordCount,1);
});
