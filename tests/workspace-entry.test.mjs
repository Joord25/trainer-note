import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=fs.readFileSync(new URL('../src/lib/workspace-entry.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {savedWorkspacePane}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('saved analysis opens changes even without a browser session or source files',()=>{
 assert.equal(savedWorkspacePane({status:'ready',report:{headline:'저장된 분석'},savedPlan:{}}),'analysis');
});
test('members with no completed analysis stay in record review',()=>{
 for(const status of ['reference','processing','error','ready'])assert.equal(savedWorkspacePane({status,report:null}),'source');
 assert.equal(savedWorkspacePane({status:'processing',report:{}}),'source');
});
test('saved plans and proposals remain accessible when analysis needs refreshing',()=>{
 assert.equal(savedWorkspacePane({status:'reference',report:null,savedPlan:{}}),'plan');
 assert.equal(savedWorkspacePane({status:'error',report:null,latestProposal:{}}),'plan');
});
