import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const dir=mkdtempSync(join(tmpdir(),'training-goal-listener-'));
try{
 const source=readFileSync(new URL('../../src/lib/training-goal-store.ts',import.meta.url),'utf8');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"][^'"]+['"]/g,"from './mocks.mjs'");
 writeFileSync(join(dir,'store.mjs'),js);
 writeFileSync(join(dir,'mocks.mjs'),`export const getClientAuth=()=>({currentUser:{uid:'test'},app:{}}),getFirestore=()=>({}),doc=(...args)=>args,validateTrainingGoal=v=>v,callAi=async()=>({});
 export let emit,options;export function onSnapshot(ref,config,onData,onError){options=config;emit=(exists,cached,data)=>onData({metadata:{fromCache:cached},exists:()=>exists,data:()=>data});return()=>{};}`);
 const {listenTrainingGoal}=await import(pathToFileURL(join(dir,'store.mjs'))),mock=await import(pathToFileURL(join(dir,'mocks.mjs')));
 const received=[];listenTrainingGoal('member',v=>received.push(v),e=>{throw e;});
 assert.equal(mock.options.includeMetadataChanges,true,'Subscribe to server confirmation even when the missing document has not changed');
 mock.emit(false,true);assert.equal(received.length,0,'Cache miss does not mean no saved goal');
 mock.emit(false,false);assert.deepEqual(received,[null],'Confirmed missing goal finishes loading and enables setup');
 const saved={primary:'근비대',revision:1};mock.emit(true,true,saved);assert.deepEqual(received.at(-1),saved,'Existing cached goal remains usable');
 console.log('Passed: goal metadata subscription, cache miss, server-confirmed empty goal, cached existing goal.');
}finally{rmSync(dir,{recursive:true});}
