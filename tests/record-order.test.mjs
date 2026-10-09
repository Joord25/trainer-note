import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/record-order.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {orderedRecordSessions}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const row=(date,page=1,sessionIndex)=>({input:{date,sourcePage:page},sessionIndex});
test('interleaves dates globally across uploaded files and PDF pages',()=>{
 const groups=[{id:'first-upload',rows:[row('2026-08-28'),row('2026-10-05',2)]},{id:'later-upload',rows:[row('2026-09-11'),row('2026-09-28',2)]}];
 const result=orderedRecordSessions(groups);
 assert.deepEqual(result.map(r=>r.date),['2026-10-05','2026-09-28','2026-09-11','2026-08-28']);
 assert.deepEqual(result.map(r=>[r.group.id,r.page]),[['first-upload',2],['later-upload',2],['later-upload',1],['first-upload',1]]);
 assert.deepEqual(result.map(r=>r.firstForFile),[true,true,false,false]);
});
test('same-day sessions retain source order and exercise order is never mutated',()=>{
 const groups=[{id:'a',rows:[row('2026-09-11',1,2),row('2026-09-11',1,1),row('2026-09-11',1,2)]},{id:'b',rows:[row('2026-09-11')]}];
 const before=JSON.stringify(groups),result=orderedRecordSessions(groups);
 assert.deepEqual(result.map(r=>r.session),['2026-09-11|2','2026-09-11|1','2026-09-11|']);assert.equal(JSON.stringify(groups),before);
 assert.deepEqual(result.map(r=>r.firstForPage),[true,false,true]);
});
test('unknown dates, unparsed pages and files awaiting reading stay accessible after dated records',()=>{
 const groups=[{id:'waiting',rows:[]},{id:'a',rows:[row(''),row('2026-10-02',2)],data:{status:'ready',unparsed:[{page:3}]}},{id:'error',rows:[],data:{status:'error',unparsed:[]}}];
 const result=orderedRecordSessions(groups,[{fileId:'a',page:4}]);
 assert.equal(result[0].date,'2026-10-02');assert.equal(result.filter(r=>r.group.id==='a').length,4);
 assert.equal(result.find(r=>r.group.id==='error').renderSession,false);assert.equal(result.find(r=>r.group.id==='waiting').renderSession,true);
});
test('changing a record date repositions only its session while preserving source identity',()=>{
 const groups=[{id:'a',rows:[row('2026-09-11')]},{id:'b',rows:[row('2026-09-28')]}];
 assert.deepEqual(orderedRecordSessions(groups).map(r=>r.group.id),['b','a']);
 groups[0].rows[0].input.date='2026-10-05';assert.deepEqual(orderedRecordSessions(groups).map(r=>r.group.id),['a','b']);
});
