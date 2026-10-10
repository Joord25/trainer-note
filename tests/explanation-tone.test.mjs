import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {withExplanationStyle} from '../functions/explanation-style.mjs';
const code=ts.transpileModule(readFileSync(new URL('../src/lib/explanation-tone.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {toFriendlyExplanation:convert}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
test('saved explanation keeps measurements, uncertainty and conditions in friendly tone',()=>{
 assert.equal(convert('등 9세트, 가슴 6세트입니다. 12.5kg으로 구성되었습니다. 향상으로 확정할 수 없습니다. 조건이 같으면 비교합니다.'),'등 9세트, 가슴 6세트예요. 12.5kg으로 구성되었어요. 향상으로 확정할 수 없어요. 조건이 같으면 비교해요.');
 assert.equal(convert('운동 구성을 보이고 있습니다. 첫 기록입니다. 변화가 보입니다. 확인하겠습니다.'),'운동 구성을 보이고 있어요. 첫 기록이에요. 변화가 보여요. 확인하겠어요.');
});
test('verbatim quotes, code, links and existing friendly prose are preserved',()=>{
 const literal='“통증이 있습니다.” `기록입니다` https://example.com/입니다 [원문입니다](https://example.com)';
 assert.equal(convert(literal),literal);
 assert.equal(convert('아직 비교하기 어려워요. 목표를 확인해주세요.'),'아직 비교하기 어려워요. 목표를 확인해주세요.');
 assert.equal(convert('표로 정리해 드립니다. 부담을 줄여줍니다.'),'표로 정리해 드려요. 부담을 줄여줘요.');
 assert.equal(convert('합니다만 추가 확인이 필요합니다.'),'합니다만 추가 확인이 필요해요.');
});
test('generation style applies only to explanatory tasks, preserving raw requests',()=>{
 const request={system:'original',parts:[{text:'기록입니다.'}],schema:{type:'object'}};
 for(const kind of ['member-changes','cycle-plan','assistant-chat','direction-discussion']){
  const styled=withExplanationStyle(kind,request);assert.match(styled.system,/해요체/);assert.equal(styled.parts,request.parts);assert.equal(styled.schema,request.schema);
 }
 for(const kind of ['extraction','search-safety','assistant-web-search'])assert.equal(withExplanationStyle(kind,request),request);
 assert.equal(request.system,'original');
});
