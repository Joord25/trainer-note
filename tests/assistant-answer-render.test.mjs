import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
let code=ts.transpileModule(readFileSync(new URL('../src/components/assistant-answer.tsx',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText;
code=code.replace(/from ["']react["']/g,`from ${JSON.stringify(pathToFileURL(require.resolve('react')).href)}`).replace(/from ["']react\/jsx-runtime["']/g,`from ${JSON.stringify(pathToFileURL(require.resolve('react/jsx-runtime')).href)}`).replace(/import \{ Icon \} from ['"]\.\/icons['"];?/,'const Icon=()=>null;');
const {AnswerText}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const render=text=>renderToStaticMarkup(React.createElement(AnswerText,{text}));
test('numbered titles and their indented explanations remain in one ordered list',()=>{
 const html=render('결론입니다.\n\n1. **운동량**\n   첫 설명입니다.\n   같은 항목의 다음 줄입니다.\n\n2. **해석**\n   두 번째 설명입니다.\n\n마지막 문단입니다.');
 assert.equal((html.match(/<ol/g)||[]).length,1);assert.equal((html.match(/<li/g)||[]).length,2);
 assert.match(html,/<li value="1"><div class="assistant-point-title"><strong[^>]*>운동량<\/strong><\/div><p>첫 설명입니다\.\n같은 항목의 다음 줄입니다\.<\/p><\/li>/);
 assert.match(html,/<\/ol><p>마지막 문단입니다\.<\/p>/);
});
test('legacy paragraphs, decimal measurements and model-supplied HTML stay intact and inert',()=>{
 const html=render('12.5kg × 10회입니다.\n\n- 기존 항목\n\n<script>alert(1)</script>');
 assert.match(html,/12\.5kg/);assert.match(html,/<ul>/);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
});
// Optional preview uses the actual renderer and actual styles, with synthetic evaluation output only.
if(process.env.ASSISTANT_PREVIEW_INPUT&&process.env.ASSISTANT_PREVIEW_OUTPUT){
 const result=JSON.parse(readFileSync(process.env.ASSISTANT_PREVIEW_INPUT,'utf8')).results.find(r=>r.id==='known-capacity'&&r.answerMode==='deep');
 assert.ok(result?.answer);
 const css=['globals','workspace-design','display-theme','coaching-journey'].map(n=>readFileSync(new URL(`../src/app/${n}.css`,import.meta.url),'utf8')).join('\n');
 const escape=t=>t.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 writeFileSync(process.env.ASSISTANT_PREVIEW_OUTPUT,`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI 도우미 답변 검증</title><style>${css}\nbody{padding:28px;background:#fff}main.review-workspace{display:block;max-width:900px;margin:auto;height:auto;min-height:0;border:0}.assistant-turn{margin:0}.preview-caption{font-size:12px;color:#748276;margin-bottom:18px}@media(max-width:500px){body{padding:16px}}</style><main class="review-workspace"><p class="preview-caption">실제 생성한 심층 답변 · 가상 사례 · 수정한 화면 표시 코드</p><article class="assistant-turn"><div class="assistant-question"><p>${escape(result.question)}</p></div><div class="assistant-answer"><small class="assistant-mode-label">심층</small>${render(result.answer)}</div></article></main></html>`);
}


test('Markdown tables render with headers and rows, including legacy escaped leading pipes',()=>{
 const html=render('식단 예시예요.\n\n   \\| 끼니 | 메뉴 |\n   \\| --- | --- |\n   \\| 첫 끼 | **밥**과 달걀 |\n   \\| 두 번째 끼 | 두부 |\n\n필요할 때 간식을 추가해요.');
 assert.equal((html.match(/<table>/g)||[]).length,1);
 assert.equal((html.match(/<th scope="col"/g)||[]).length,2);
 assert.equal((html.match(/<td>/g)||[]).length,4);
 assert.match(html,/<strong[^>]*>밥<\/strong>/);assert.match(html,/<\/table><\/div><p>필요할 때/);
});
test('table cells keep HTML inert and non-table pipes stay prose',()=>{
 const html=render('| 끼니 | 메뉴 |\n| --- | --- |\n| 첫 끼 | <img src=x onerror=alert(1)> |');
 assert.ok(!html.includes('<img'));assert.match(html,/&lt;img/);
 assert.ok(!render('밥 | 면 중 선택').includes('<table>'));
});
