import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/member-order.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {orderedMemberIds,moveMemberId}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('saved order survives member additions, deletions and duplicate stale IDs',()=>{
 assert.deepEqual(orderedMemberIds(['new','a','b','hidden'],['gone','b','b','a']),['b','a','new','hidden']);
});
test('moving visible cards preserves hidden members and never loses or duplicates members',()=>{
 const original=['a','hidden','b','ended','c'];
 const moved=moveMemberId(original,'a','b');
 assert.deepEqual(moved.filter(id=>['a','b','c'].includes(id)),['b','a','c']);
 assert.deepEqual(moved.filter(id=>['hidden','ended'].includes(id)),['hidden','ended']);
 assert.deepEqual([...moved].sort(),[...original].sort());
 assert.deepEqual(original,['a','hidden','b','ended','c']);
 assert.deepEqual(moveMemberId(moved,'c','b').filter(id=>['a','b','c'].includes(id)),['c','b','a']);
 assert.deepEqual(moveMemberId(original,'deleted','b'),original);
});
