import {readFileSync} from "node:fs";
import {before,after,beforeEach,test} from "node:test";
import assert from "node:assert/strict";
import {initializeTestEnvironment,assertSucceeds,assertFails} from "@firebase/rules-unit-testing";
import {doc,setDoc,getDoc,deleteDoc,updateDoc,writeBatch,serverTimestamp,getDocs,collection} from "firebase/firestore";
import {ref,uploadBytes,getMetadata,deleteObject,listAll} from "firebase/storage";
let env;
const id="a".repeat(64),otherId="b".repeat(64);
const parent="trainers/trainer-a/members/member-1",filePath=parent+"/files/"+id,objectPath=filePath+"/source.pdf";
const bytes=new TextEncoder().encode("%PDF-1.4\ntest\n%%EOF");
const member=()=>({name:"회원",goal:"",notes:"",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const file=()=>({name:"운동.pdf",size:bytes.length,contentType:"application/pdf",status:"uploading",createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
const context=uid=>uid?env.authenticatedContext(uid):env.unauthenticatedContext();
async function reserve(db,fileId=id,patch={}){
 const p=doc(db,parent),old=await getDoc(p),batch=writeBatch(db);
 batch.update(p,{fileCount:(old.data().fileCount??0)+1,lastFileId:fileId,updatedAt:serverTimestamp()});
 batch.set(doc(db,parent+"/files/"+fileId),{...file(),...patch});
 return batch.commit();
}
async function erase(db,fileId=id){
 const p=doc(db,parent),old=await getDoc(p),batch=writeBatch(db);
 batch.update(p,{fileCount:old.data().fileCount-1,lastFileId:fileId,updatedAt:serverTimestamp()});
 batch.delete(doc(db,parent+"/files/"+fileId));return batch.commit();
}
before(async()=>{
 if(!process.env.FIRESTORE_EMULATOR_HOST||!process.env.FIREBASE_STORAGE_EMULATOR_HOST)throw new Error("Both emulators required");
 env=await initializeTestEnvironment({projectId:"demo-trainer-note",firestore:{rules:readFileSync("firestore.rules","utf8")},storage:{rules:readFileSync("storage.rules","utf8")}});
});
beforeEach(async()=>{await env.clearFirestore();// The SDK helper only deletes root objects; our files live in nested prefixes.
 await env.withSecurityRulesDisabled(async ctx=>{
  async function clear(folder){const result=await listAll(folder);await Promise.all(result.items.map(deleteObject));for(const prefix of result.prefixes)await clear(prefix);}
  await clear(ref(ctx.storage()));
 });await setDoc(doc(context("trainer-a").firestore(),parent),member());});
after(async()=>{await env?.cleanup();});
test("full owner reservation, upload, confirm, delete and parent removal",async()=>{
 const own=context("trainer-a"),db=own.firestore(),object=ref(own.storage(),objectPath);
 await assertSucceeds(reserve(db));
 await assertSucceeds(uploadBytes(object,bytes,{contentType:"application/pdf"}));
 await assertSucceeds(updateDoc(doc(db,filePath),{status:"ready",updatedAt:serverTimestamp()}));
 assert.equal((await getMetadata(object)).size,bytes.length);
 await assertFails(deleteDoc(doc(db,parent)));
 await assertSucceeds(updateDoc(doc(db,filePath),{status:"deleting",updatedAt:serverTimestamp()}));
 await assertSucceeds(deleteObject(object));await assertSucceeds(erase(db));
 assert.equal((await getDoc(doc(db,parent))).data().fileCount,0);
 await assertSucceeds(deleteDoc(doc(db,parent)));
});
for(const uid of [null,"trainer-b"]){
 test(`${uid??"anonymous"} cannot access or alter another trainer files`,async()=>{
  const own=context("trainer-a");await reserve(own.firestore());await uploadBytes(ref(own.storage(),objectPath),bytes,{contentType:"application/pdf"});
  const other=context(uid),db=other.firestore(),object=ref(other.storage(),objectPath);
  await assertFails(getDoc(doc(db,filePath)));await assertFails(getDocs(collection(db,parent+"/files")));
  await assertFails(setDoc(doc(db,parent+"/files/"+otherId),file()));await assertFails(updateDoc(doc(db,filePath),{status:"deleting",updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(db,filePath)));
  await assertFails(getMetadata(object));await assertFails(uploadBytes(object,bytes,{contentType:"application/pdf"}));await assertFails(deleteObject(object));
 });
}
test("counter cannot be changed without matching manifest mutation",async()=>{
 const db=context("trainer-a").firestore();
 await assertFails(updateDoc(doc(db,parent),{fileCount:1,lastFileId:id,updatedAt:serverTimestamp()}));
 await reserve(db);
 await assertFails(updateDoc(doc(db,parent),{fileCount:0,lastFileId:id,updatedAt:serverTimestamp()}));
 await assertFails(deleteDoc(doc(db,filePath)));
 await assertFails(erase(db));
});
test("manifest cannot be reserved without parent and counter transaction",async()=>{
 const db=context("trainer-a").firestore();await assertFails(setDoc(doc(db,filePath),file()));
 await deleteDoc(doc(db,parent));await assertFails(setDoc(doc(db,filePath),file()));
});
test("storage rejects uploads without a reservation, wrong MIME/size and overwrite",async()=>{
 const own=context("trainer-a"),object=ref(own.storage(),objectPath);
 await assertFails(uploadBytes(object,bytes,{contentType:"application/pdf"}));await reserve(own.firestore());
 await assertFails(uploadBytes(object,bytes,{contentType:"image/png"}));
 await assertFails(uploadBytes(object,bytes.slice(0,5),{contentType:"application/pdf"}));
 await uploadBytes(object,bytes,{contentType:"application/pdf"});
 await assertFails(uploadBytes(object,bytes,{contentType:"application/pdf"}));
 await assertFails(listAll(ref(own.storage(),parent+"/files")));
});
test("deleting reservations reject late upload and cannot become ready again",async()=>{
 const own=context("trainer-a"),db=own.firestore();await reserve(db);
 await updateDoc(doc(db,filePath),{status:"deleting",updatedAt:serverTimestamp()});
 await assertFails(uploadBytes(ref(own.storage(),objectPath),bytes,{contentType:"application/pdf"}));
 await assertFails(updateDoc(doc(db,filePath),{status:"ready",updatedAt:serverTimestamp()}));
 await assertSucceeds(erase(db));
});
for(const [label,patch] of [["non-PDF type",{contentType:"text/html"}],["oversize",{size:50*1024*1024+1}],["zero bytes",{size:0}],["extra owner",{ownerId:"trainer-b"}],["long filename",{name:"x".repeat(201)}],["fabricated ready",{status:"ready"}]]){
 test(`invalid manifest rejected: ${label}`,async()=>{await assertFails(reserve(context("trainer-a").firestore(),id,patch));});
}
test("immutable metadata and cross-member path rejected",async()=>{
 const own=context("trainer-a"),db=own.firestore();await reserve(db);
 await assertFails(updateDoc(doc(db,filePath),{size:1,updatedAt:serverTimestamp()}));
 await assertFails(uploadBytes(ref(own.storage(),objectPath.replace('member-1','member-2')),bytes,{contentType:"application/pdf"}));
});
