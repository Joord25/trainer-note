import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/lib/ai-response.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {unwrapAiResponse}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('failed workflow context reaches the retry UI instead of throwing away the input key',()=>{
 const value={status:'error',error:'이전 작업 실패',inputKey:'current',evidence:[{id:'a'}],report:null};
 for(const action of ['workflowContext','analyzeChanges'])assert.equal(unwrapAiResponse(action,value),value);
});
test('failed cycle status reaches its polling handler',()=>{
 const value={status:'error',error:'실패',proposalId:'p'};assert.equal(unwrapAiResponse('cycleStatus',value),value);
});
test('transport-style errors and unrelated actions still reject',()=>{
 assert.throws(()=>unwrapAiResponse('workflowContext',{error:'조회 실패'}),/조회 실패/);
 assert.throws(()=>unwrapAiResponse('read',{status:'error',error:'판독 실패',inputKey:'x',evidence:[]}),/판독 실패/);
 assert.throws(()=>unwrapAiResponse('cycleStatus',{error:'조회 실패'}),/조회 실패/);
});
test('successful results are returned unchanged',()=>{const value={status:'ready',error:''};assert.equal(unwrapAiResponse('workflowContext',value),value);});
