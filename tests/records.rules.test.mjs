import {readFileSync} from "node:fs";
import {before,after,beforeEach,test} from "node:test";
import assert from "node:assert/strict";
import {initializeTestEnvironment,assertSucceeds,assertFails} from "@firebase/rules-unit-testing";
import {doc,setDoc,getDoc,getDocs,collection,query,orderBy,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp} from "firebase/firestore";
let env;const path="trainers/trainer-a/members/member-1",id="a".repeat(20),rp=path+"/records/"+id;
const db=uid=>uid?env.authenticatedContext(uid).firestore():env.unauthenticatedContext().firestore();
const valid=()=>({performedAt:Timestamp.fromDate(new Date('2026-06-09T12:00:00Z')),rawName:'BB sq',exerciseName:'바벨 백 스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:40,reps:12},{kg:60,reps:10}],sourceName:'',sourceHash:'',sourcePage:0,notes:'',status:'confirmed',origin:'manual',revision:1,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
async function create(d,patch={}){const batch=writeBatch(d);batch.set(doc(d,rp),{...valid(),...patch});batch.update(doc(d,path),{recordCount:1,lastRecordId:id,updatedAt:serverTimestamp()});return batch.commit();}
async function erase(d){const batch=writeBatch(d);batch.delete(doc(d,rp));batch.update(doc(d,path),{recordCount:0,lastRecordId:id,updatedAt:serverTimestamp()});return batch.commit();}
before(async()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw new Error('Emulator required');env=await initializeTestEnvironment({projectId:'demo-trainer-note',firestore:{rules:readFileSync('firestore.rules','utf8')}});});
beforeEach(async()=>{await env.clearFirestore();await setDoc(doc(db('trainer-a'),path),{name:'회원',goal:'',notes:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp()});});
after(async()=>{await env?.cleanup();});
test('owner record persistence, date query, revision update and counted deletion',async()=>{
 const d=db('trainer-a');await assertSucceeds(create(d));assert.equal((await getDocs(query(collection(db('trainer-a'),path+'/records'),orderBy('performedAt','desc')))).size,1);
 await assertFails(deleteDoc(doc(d,path)));
 await assertSucceeds(updateDoc(doc(d,rp),{notes:'수정',revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(d,rp),{notes:'오래된 수정',revision:2,updatedAt:serverTimestamp()}));
 await assertSucceeds(erase(d));await assertSucceeds(deleteDoc(doc(d,path)));
});
for(const uid of [null,'trainer-b'])test(`${uid??'anonymous'} cannot access another trainer workout`,async()=>{
 await create(db('trainer-a'));const d=db(uid);
 await assertFails(getDoc(doc(d,rp)));await assertFails(getDocs(collection(d,path+'/records')));await assertFails(setDoc(doc(d,rp),valid()));await assertFails(updateDoc(doc(d,rp),{notes:'x',revision:2,updatedAt:serverTimestamp()}));await assertFails(deleteDoc(doc(d,rp)));
});
test('record counters require matching atomic mutations and parent existence',async()=>{
 const d=db('trainer-a');await assertFails(setDoc(doc(d,rp),valid()));await assertFails(updateDoc(doc(d,path),{recordCount:1,lastRecordId:id,updatedAt:serverTimestamp()}));
 await create(d);await assertFails(deleteDoc(doc(d,rp)));await assertFails(updateDoc(doc(d,path),{recordCount:0,lastRecordId:id,updatedAt:serverTimestamp()}));
 await erase(d);await deleteDoc(doc(d,path));await assertFails(setDoc(doc(d,rp),valid()));
});
const invalid=[['empty exercise',{exerciseName:''}],['unknown field',{admin:true}],['invalid part',{bodyPart:'허위'}],['empty sets',{sets:[]}],['too many sets',{sets:Array.from({length:9},()=>({kg:20,reps:10}))}],['unknown load type',{loadType:'fake'}],['wrong origin',{origin:'ai'}],['unconfirmed',{status:'draft'}],['wrong timestamp',{performedAt:'6/9'}],['future limit',{performedAt:Timestamp.fromDate(new Date('2102-01-01'))}],['missing PDF page',{sourceName:'운동.pdf',sourceHash:'a'.repeat(64),sourcePage:0}],['PDF name without hash',{sourceName:'운동.pdf'}],['fake PDF hash',{sourceName:'운동.pdf',sourceHash:'bad',sourcePage:1}],['long notes',{notes:'x'.repeat(1001)}]];
for(const [name,patch]of invalid)test(`reject invalid record: ${name}`,async()=>{await assertFails(create(db('trainer-a'),patch));});
for(let i=0;i<8;i++)test(`validate every set including position ${i+1}`,async()=>{
 const sets=Array.from({length:8},()=>({kg:20,reps:10}));sets[i]={kg:20,reps:-1};await assertFails(create(db('trainer-a'),{sets}));
});
test('bodyweight and unknown weight remain null; max sets and fractional kg accepted',async()=>{
 const d=db('trainer-a');await assertSucceeds(create(d,{loadType:'bodyweight',sets:[{kg:null,reps:20}]}));
 await assertFails(updateDoc(doc(d,rp),{sets:[{kg:0,reps:20}],revision:2,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(d,rp),{loadType:'unknown',revision:2,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(d,rp),{loadType:'weighted',sets:Array.from({length:8},()=>({kg:12.5,reps:10})),revision:3,updatedAt:serverTimestamp()}));
});
test('source fingerprint and creation time cannot be rewritten',async()=>{
 const d=db('trainer-a');await create(d,{sourceName:'일지.pdf',sourceHash:'a'.repeat(64),sourcePage:1});
 await assertFails(updateDoc(doc(d,rp),{sourceHash:'b'.repeat(64),revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(d,rp),{sourceName:'다른.pdf',revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(d,rp),{createdAt:Timestamp.fromMillis(0),revision:2,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(d,rp),{sourcePage:2,revision:2,updatedAt:serverTimestamp()}));
});
test('maximum eight distinct weighted sets can be created atomically',async()=>{
 const d=db('trainer-a');await assertSucceeds(create(d,{sets:Array.from({length:8},(_,i)=>({kg:20+i*2.5,reps:12-i}))}));
 assert.equal((await getDoc(doc(d,rp))).data().sets.length,8);
});
for(const [name,set]of [['missing kg',{reps:10}],['missing reps',{kg:20}],['extra field',{kg:20,reps:10,admin:true}],['negative kg',{kg:-1,reps:10}],['fractional reps',{kg:20,reps:1.5}],['null weighted kg',{kg:null,reps:10}]])test(`reject malformed set: ${name}`,async()=>{await assertFails(create(db('trainer-a'),{sets:[set]}));});

test('AI-reviewed records require source provenance and retain origin on edit',async()=>{
 const d=db('trainer-a');await assertFails(create(d,{origin:'ai-reviewed'}));
 await assertSucceeds(create(d,{origin:'ai-reviewed',sourceHash:'a'.repeat(64),sourceName:'일지.png',sourcePage:1}));
 await assertSucceeds(updateDoc(doc(d,rp),{notes:'트레이너가 무게 확인',revision:2,updatedAt:serverTimestamp()}));
 await assertFails(updateDoc(doc(d,rp),{origin:'manual',revision:3,updatedAt:serverTimestamp()}));
});

test('client cannot forge auto acceptance but owner can confirm server provisional record',async()=>{
 const d=db('trainer-a'),provenance={sourceHash:'a'.repeat(64),sourceName:'일지.png',sourcePage:1};
 await assertFails(create(d,{...provenance,origin:'ai-auto'}));await assertFails(create(d,{...provenance,origin:'ai-auto',status:'provisional'}));
 await env.withSecurityRulesDisabled(async context=>{const admin=context.firestore();await setDoc(doc(admin,rp),{...valid(),...provenance,origin:'ai-auto',status:'provisional'});await updateDoc(doc(admin,path),{recordCount:1,lastRecordId:id});});
 await assertSucceeds(getDoc(doc(d,rp)));await assertFails(getDoc(doc(db('trainer-b'),rp)));
 await assertFails(updateDoc(doc(d,rp),{revision:2,updatedAt:serverTimestamp()}));
 await assertSucceeds(updateDoc(doc(d,rp),{status:'confirmed',revision:2,notes:'중량 확인',updatedAt:serverTimestamp()}));
});
for(const kind of ['imports','analysis','reports','plans','corrections'])test(`${kind} owner reads but no client may write AI-owned state`,async()=>{
 const target=path+'/'+kind+'/current';await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),target),{status:'ready'}));
 await assertSucceeds(getDoc(doc(db('trainer-a'),target)));await assertFails(getDoc(doc(db('trainer-b'),target)));await assertFails(setDoc(doc(db('trainer-a'),target),{status:'ready'}));await assertFails(deleteDoc(doc(db('trainer-a'),target)));
});
for(const kind of ['aiUsage','aiDaily','aiCalls'])test(`${kind} cannot be reset or forged by client`,async()=>{
 const target='trainers/trainer-a/'+kind+'/current';await env.withSecurityRulesDisabled(async c=>setDoc(doc(c.firestore(),target),{calls:5}));await assertSucceeds(getDoc(doc(db('trainer-a'),target)));await assertFails(getDoc(doc(db('trainer-b'),target)));await assertFails(updateDoc(doc(db('trainer-a'),target),{calls:0}));await assertFails(deleteDoc(doc(db('trainer-a'),target)));
});
