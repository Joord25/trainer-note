import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync(new URL('../../src/lib/assessment-followup.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {appendFollowupAnswer,followupPlaceholder}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('follow-up answers preserve earlier question/answer context without resending blank input',()=>{
 const first=appendFollowupAnswer('','속도는 km/h',['속도 단위는?']);
 const second=appendFollowupAnswer(first,'기울기는 %',['기울기 단위는?']);
 assert.match(second,/속도는 km\/h/);assert.match(second,/기울기는 %/);
 assert.equal(appendFollowupAnswer(second,'  ',[]),second);
});
test('answer budget never silently truncates earlier facts and placeholder does not invent answers',()=>{
 assert.throws(()=>appendFollowupAnswer('x'.repeat(1999),'새 답변',[]));
 assert.equal(followupPlaceholder(['속도?','자세?']),'위 질문 순서대로 답변 입력');
 assert.equal(followupPlaceholder(['자세?']),'위 질문에 대한 답변 입력');
});
