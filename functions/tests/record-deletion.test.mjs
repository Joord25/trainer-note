import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {createRecordDeletion} from '../record-deletion.mjs';
let app,db,remove,reports;
const base='trainers/bulk-test/members/member',fileId='a'.repeat(64),id=n=>String(n).padStart(20,'0');
const target=n=>({id:id(n),fileId,rowRevision:1,recordRevision:1});
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'record-deletion-test');db=getFirestore(app);});
after(()=>deleteApp(app));
beforeEach(async()=>{
 await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-trainer-note/databases/(default)/documents`,{method:'DELETE'});reports=0;
 remove=createRecordDeletion({db,scheduleReport:async()=>{reports++;}});
 await db.doc(base).set({recordCount:3,fileCount:1});await db.doc(base+'/files/'+fileId).set({status:'ready'});
 await db.doc(base+'/imports/'+fileId).set({status:'ready',revision:1,rows:[1,2,3,4].map(n=>({id:id(n),revision:1,review:n===4?'needs-review':'confirmed'}))});
 for(const n of [1,2,3])await db.doc(base+'/records/'+id(n)).set({revision:1,sourceHash:fileId});
});
test('selected deletion preserves other records and original, removes drafts and is idempotent',async()=>{
 const targets=[target(1),{...target(4),recordRevision:0}],result=await remove('bulk-test','member',{targets});
 assert.deepEqual(result.failed,[]);assert.equal((await db.doc(base).get()).data().recordCount,2);
 assert.equal((await db.doc(base+'/files/'+fileId).get()).exists,true);assert.equal((await db.doc(base+'/records/'+id(2)).get()).exists,true);
 const rows=(await db.doc(base+'/imports/'+fileId).get()).data().rows;assert.equal(rows[0].review,'ignored');assert.equal(rows[3].review,'ignored');
 assert.deepEqual((await remove('bulk-test','member',{targets})).failed,[]);assert.equal((await db.doc(base).get()).data().recordCount,2);assert.equal(reports,2);
});
test('stale selection refuses the whole chunk without losing current edits',async()=>{
 await db.doc(base+'/records/'+id(2)).update({revision:2});const result=await remove('bulk-test','member',{targets:[target(1),target(2)]});assert.equal(result.failed.length,2);assert.equal((await db.collection(base+'/records').get()).size,3);
});
test('source lock and other trainer cannot delete records',async()=>{
 await db.doc(base+'/files/'+fileId).update({status:'deleting'});assert.equal((await remove('bulk-test','member',{targets:[target(1)]})).failed.length,1);
 assert.equal((await remove('foreign','member',{targets:[target(1)]})).failed.length,1);assert.equal((await db.collection(base+'/records').get()).size,3);
 await assert.rejects(remove('bulk-test','member',{targets:[target(1),target(1)]}));
});
test('multiple chunks preserve partial failure and newer, unselected records',async()=>{
 const batch=db.batch();for(let n=5;n<=55;n++)batch.set(db.doc(base+'/records/'+id(n)),{revision:1,sourceHash:''});batch.update(db.doc(base),{recordCount:54});await batch.commit();
 const targets=Array.from({length:51},(_,i)=>({id:id(i+5),recordRevision:i===50?2:1}));const result=await remove('bulk-test','member',{targets});assert.equal(result.deletedIds.length,50);assert.equal(result.failed.length,1);assert.equal((await db.doc(base).get()).data().recordCount,4);assert.equal((await db.doc(base+'/records/'+id(55)).get()).exists,true);
});

test('saved records remain deletable after original and interpretation are gone',async()=>{
 await db.doc(base+'/files/'+fileId).delete();await db.doc(base+'/imports/'+fileId).delete();
 assert.deepEqual((await remove('bulk-test','member',{targets:[target(1)]})).failed,[]);
 assert.equal((await db.doc(base+'/records/'+id(1)).get()).exists,false);
 assert.equal((await db.doc(base).get()).data().recordCount,2);
 assert.equal((await db.doc(base+'/records/'+id(2)).get()).exists,true);
});
