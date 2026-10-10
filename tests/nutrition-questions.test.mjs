import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {prepareChatFacts,validateChatRequest} from '../functions/chat.mjs';
import {requestedSearchMode,searchDecision} from '../functions/web-search.mjs';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/nutrition-questions.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {nutritionQuestions}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('every one-click topic requests public research and excludes member facts',()=>{
 for(const {question} of nutritionQuestions){
  validateChatRequest({requestId:'11111111-1111-4111-a111-111111111111',question,fileId:''});
  assert.equal(requestedSearchMode(question),'required');
  assert.equal(searchDecision({searchDecision:'search',searchQuery:'sports nutrition guidelines',evidenceNeed:'sufficient'},question).requested,true);
  const facts=prepareChatFacts({question,history:[],goal:'PRIVATE_GOAL',notes:'PRIVATE_NOTES',sessionNotes:[{text:'PRIVATE_FATIGUE'}],training:{secret:'PRIVATE_TRAINING'},records:[{id:'PRIVATE_RECORD'}],asOf:'2026-10-11'});
  assert.deepEqual(facts.records,[]);
  assert.equal(facts.nutrition.conditions.goal,undefined);
  assert.equal(facts.chatContext.separateCase,true);
  assert.ok(!JSON.stringify(facts).includes('PRIVATE_'));
 }
});
