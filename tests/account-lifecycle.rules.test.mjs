import {test,before,after} from 'node:test';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {readFileSync} from 'node:fs';
import {doc,getDoc,setDoc} from 'firebase/firestore';
let env;
before(async()=>{if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('Emulator required');env=await initializeTestEnvironment({projectId:'demo-trainer-note',firestore:{rules:readFileSync('firestore.rules','utf8')}});});
after(()=>env.cleanup());
test('deletion lock rejects an otherwise valid owner token and cannot be removed by client',async()=>{
 await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'trainers/deleting/members/member'),{name:'가상 회원'});await setDoc(doc(context.firestore(),'accountDeletions/deleting'),{status:'pending'});await setDoc(doc(context.firestore(),'trainers/remaining/members/member'),{name:'다른 가상 회원'});});
 const locked=env.authenticatedContext('deleting').firestore(),other=env.authenticatedContext('remaining').firestore();await assertFails(getDoc(doc(locked,'trainers/deleting/members/member')));await assertFails(setDoc(doc(locked,'accountDeletions/deleting'),{}));await assertSucceeds(getDoc(doc(other,'trainers/remaining/members/member')));
});
