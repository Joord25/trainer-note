import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/member-status.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {membersInFolder,memberStatus}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('legacy members stay active; folders separate same-named members without losing any',()=>{
 const members=[{id:'legacy',name:'김회원'},{id:'active',name:'김회원',status:'active'},{id:'hidden',name:'김회원',status:'hidden'},{id:'ended',name:'김회원',status:'ended'}];
 const ids=folder=>membersInFolder(members,folder).map(m=>m.id);
 assert.deepEqual(ids('active'),['legacy','active']);assert.deepEqual(ids('hidden'),['hidden']);assert.deepEqual(ids('ended'),['ended']);assert.equal(ids('all').length,4);assert.equal(memberStatus(undefined),'active');
 const restored=members.map(m=>m.id==='hidden'?{...m,status:'active'}:m);
 assert.equal(membersInFolder(restored,'active').length,3);assert.equal(membersInFolder(restored,'hidden').length,0);assert.equal(membersInFolder(restored,'all').length,4);assert.equal(members[2].status,'hidden');
});
