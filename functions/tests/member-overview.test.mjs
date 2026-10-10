import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {initializeApp,deleteApp} from 'firebase-admin/app';
import {getFirestore,Timestamp} from 'firebase-admin/firestore';
import {memberOverviews} from '../member-overview.mjs';
let app,db;const uid='overview-test',base=`trainers/${uid}/members/a`;
before(()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');app=initializeApp({projectId:'demo-trainer-note'},'overview');db=getFirestore(app);});
after(()=>deleteApp(app));
beforeEach(async()=>{await db.recursiveDelete(db.doc(`trainers/${uid}`));await db.doc(base).set({goal:'예전 목표'});});
test('canonical goal, latest record and saved artifacts are returned without record or plan contents',async()=>{
 await db.doc(base+'/trainingGoals/current').set({primary:'다이어트(체지방 감소)',secondary:['근력'],detail:''});
 await db.doc(base+'/records/old').set({performedAt:Timestamp.fromDate(new Date('2026-09-01'))});
 await db.doc(base+'/records/new').set({performedAt:Timestamp.fromDate(new Date('2026-10-01')),notes:'private record'});
 await db.doc(base+'/changeReviews/ready').set({status:'ready',updatedAt:Timestamp.now(),report:{text:'private report'}});
 await db.doc(base+'/cyclePlans/current').set({plan:{sessions:[{items:['private plan']}]}});
 const value=(await memberOverviews(db,uid,['a'])).a;
 assert.equal(value.goal,'다이어트(체지방 감소)');assert.equal(value.lastRecordDate,'2026-10-01');assert.equal(value.hasAnalysis,true);assert.equal(value.hasPlan,true);assert.deepEqual(value.secondary,['근력']);assert.ok(!JSON.stringify(value).includes('private'));
});
test('legacy goals and empty states are explicit; custom goal uses its title',async()=>{
 assert.deepEqual((await memberOverviews(db,uid,['a'])).a,{goal:'예전 목표',secondary:[],lastRecordDate:'',hasAnalysis:false,hasPlan:false,analysisDate:''});
 await db.doc(base+'/trainingGoals/current').set({primary:'직접 설정',detail:'5km 완주'});
 assert.equal((await memberOverviews(db,uid,['a'])).a.goal,'5km 완주');
});
test('another trainer member is not readable through an ID; invalid paths and oversized batches rejected',async()=>{
 await db.doc('trainers/overview-other/members/private').set({goal:'secret'});
 assert.deepEqual((await memberOverviews(db,uid,['private'])).private,{error:true});
 for(const ids of [[],['a','a'],['../private'],Array.from({length:51},(_,i)=>String(i)),null])await assert.rejects(memberOverviews(db,uid,ids));
 await db.recursiveDelete(db.doc('trainers/overview-other'));
});
