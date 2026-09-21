import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
// Load production TSX in an isolated Node test process without writing generated UI files.
const require=createRequire(import.meta.url);
for(const extension of ['.ts','.tsx'])require.extensions[extension]=(module,filename)=>module._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);
const {AnalysisSource}=require('../src/components/analysis-source.tsx');
const {SourceActions}=require('../src/components/source-actions.tsx');
const {ContinuousSourceViewer}=require('../src/components/continuous-source-viewer.tsx');
const file={id:'a'.repeat(64),name:'multi-date.png',status:'ready',contentType:'image/png',size:10,createdAt:null,pending:false};
const row=(id,date,sessionIndex)=>({id,sessionIndex,programSection:'W.O.D',review:'confirmed',issues:[],fileId:file.id,input:{date,sourceHash:file.id,sourceName:file.name,sourcePage:1,rawName:'squat',exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:20,reps:10}],notes:''}});
const noop=()=>{};
function render(rows){return renderToStaticMarkup(React.createElement(AnalysisSource,{memberId:'m',memberName:'회원',online:true,files:[file],imports:[],rows,selectedFile:file.id,selectedRow:'',onFile:noop,onRow:noop,onUpload:noop,onDirty:noop,recordsOnly:true}));}
test('one source page renders two independent date cards and two scoped date controls',()=>{
 const html=render([row('first','2026-01-21',1),row('second','2026-01-26',2)]);
 assert.equal((html.match(/data-record-page="1"/g)||[]).length,2);
 assert.match(html,/<h2>2026-01-21 수업<\/h2>/);assert.match(html,/<h2>2026-01-26 수업<\/h2>/);
 assert.equal((html.match(/수업 날짜 적용/g)||[]).length,2);assert.ok(!html.includes('이 페이지 전체 적용'));
 assert.equal((html.match(/W.O.D/g)||[]).length,2);
});
test('separate unknown-date source regions remain separate cards',()=>{
 const html=render([row('first','',1),row('second','',2)]);assert.equal((html.match(/<h2>날짜 확인 필요<\/h2>/g)||[]).length,2);
});
test('source menu contains editing only, with no deletion actions',()=>{
 const html=renderToStaticMarkup(React.createElement(SourceActions,{memberId:'m',file,online:true,onEdit:noop,onBeforeAction:()=>true,onNotice:noop}));
 for(const label of ['원본 메뉴','파일명 수정','이 원본의 기록 수정'])assert.ok(html.includes(label));assert.ok(!html.includes('삭제'));
});
test('records and originals expose labelled item selection and whole-list deletion',()=>{
 const html=render([row('first','2026-01-21',1),row('second','2026-01-26',2)]);
 assert.match(html,/기록 전체 선택/);assert.match(html,/선택 기록 삭제/);assert.match(html,/전체 기록 삭제/);
 assert.equal((html.match(/type="checkbox"/g)||[]).length,3);
 const original=renderToStaticMarkup(React.createElement(ContinuousSourceViewer,{memberId:'m',files:[file],selectedFile:file.id,online:true}));
 assert.match(original,/원본 전체 선택/);assert.ok(!original.includes('전체 원본 삭제'));assert.ok(!original.includes('원본·연결 기록 삭제'));assert.ok(!original.includes('class="original-trash"'));
 assert.equal((original.match(/type="checkbox"/g)||[]).length,2);
 assert.equal((original.match(/aria-label="원본 메뉴"/g)||[]).length,1);
 assert.ok(!original.includes('class="original-controls"'));
 assert.ok(!original.includes('class="bulk-selection-bar"'));
});
test('archived originals disappear from the viewer while their records remain editable',()=>{
 const original=renderToStaticMarkup(React.createElement(ContinuousSourceViewer,{memberId:'m',files:[{...file,originalRemoved:true}],selectedFile:file.id,online:true}));
 assert.ok(!original.includes('data-source-file='));assert.match(original,/원본 없음/);
 const html=render([row('first','2026-01-21',1)]);assert.match(html,/스쿼트/);
});
