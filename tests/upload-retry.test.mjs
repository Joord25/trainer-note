import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const compile=path=>ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sourceExports={};vm.runInNewContext(compile('../src/lib/source-file.ts'),{exports:sourceExports,crypto,TextDecoder,Uint8Array,Error});
const file=new File([new Uint8Array([255,216,255,224])],'김규동 9:11.jpg');
async function harness(existing,stored=false){
 const manifests=new Map(),writes=[],uploads=[];const {id}=await sourceExports.inspectSourceFile(file);if(existing)manifests.set(id,{size:file.size,contentType:'image/jpeg',...existing});
 const auth={currentUser:{uid:'u'},app:{}};
 const firestore={getFirestore:()=>({}),doc:(parent,...parts)=>({id:parts.at(-1),path:[parent.path,...parts].filter(Boolean).join('/')}),collection:(parent,part)=>({path:parent.path+'/'+part}),serverTimestamp:()=>1,runTransaction:async(_db,callback)=>callback({get:async ref=>({exists:()=>ref.id==='m'||manifests.has(ref.id),data:()=>ref.id==='m'?{fileCount:existing?1:0}:manifests.get(ref.id)}),set:(ref,data)=>{writes.push(['set',ref.id]);manifests.set(ref.id,data);},update:(ref,data)=>{writes.push(['update',ref.id]);if(manifests.has(ref.id))manifests.set(ref.id,{...manifests.get(ref.id),...data});}})};
 const storage={getStorage:()=>({}),ref:(_storage,path)=>path,getMetadata:async()=>{if(!stored)throw Object.assign(new Error('missing'),{code:'storage/object-not-found'});return {size:file.size,contentType:'image/jpeg'};},uploadBytesResumable:(_ref,_file)=>{uploads.push(_file.name);stored=true;return {cancel(){},on:(_event,_progress,_error,done)=>done()};}};
 const exports={};vm.runInNewContext(compile('../src/lib/member-files.ts'),{exports,process:{env:{NEXT_PUBLIC_STORAGE_ENABLED:'true'}},Error,DOMException,Promise,require:name=>({'firebase/firestore':firestore,'firebase/storage':storage,'./firebase-client':{getClientAuth:()=>auth},'./server-ai':{},'./source-file':sourceExports}[name])});
 return {run:()=>exports.uploadMemberFile('m',file,()=>{},new AbortController().signal),writes,uploads,manifests,id};
}
test('same content with a different name returns the actual existing file and does not upload',async()=>{
 const h=await harness({name:'BandPhoto.jpg',status:'ready'});
 await assert.rejects(h.run(),e=>e instanceof sourceExports.DuplicateSourceError&&e.existing.name==='BandPhoto.jpg'&&e.existing.id===h.id);
 assert.equal(h.uploads.length,0);assert.equal(h.writes.length,0);
});
test('interrupted upload can retry without incrementing the member file count again',async()=>{
 const h=await harness({name:'BandPhoto.jpg',status:'uploading'});await h.run();
 assert.equal(h.uploads.length,1);assert.equal(h.manifests.get(h.id).status,'ready');assert.equal(h.manifests.get(h.id).name,'BandPhoto.jpg');assert.deepEqual(h.writes,[['update',h.id]]);
});
test('archived or deleting files are never overwritten by retry',async()=>{
 for(const state of [{status:'ready',originalRemoved:true},{status:'deleting'}]){const h=await harness({name:'기존.jpg',...state});await assert.rejects(h.run(),e=>e instanceof sourceExports.DuplicateSourceError);assert.equal(h.uploads.length,0);assert.equal(h.writes.length,0);}
});
test('new upload reserves and counts once, then finalizes',async()=>{
 const h=await harness();assert.equal(await h.run(),h.id);assert.deepEqual(h.writes,[['set',h.id],['update','m'],['update',h.id]]);assert.equal(h.manifests.get(h.id).name,file.name);
});

test('retry confirms already stored bytes without attempting a forbidden overwrite',async()=>{
 const h=await harness({name:'기존.jpg',status:'uploading'},true);await h.run();
 assert.equal(h.uploads.length,0);assert.equal(h.manifests.get(h.id).status,'ready');assert.deepEqual(h.writes,[['update',h.id]]);
});
