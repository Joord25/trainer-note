import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const require=createRequire(import.meta.url);
for(const ext of ['.ts','.tsx'])require.extensions[ext]=(module,file)=>module._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
const {DuplicateSourceError}=require('../src/lib/source-file.ts');
const {uploadSummaryText}=require('../src/lib/upload-result.ts');
const {UploadFeedback}=require('../src/components/upload-feedback.tsx');
const noop=()=>{};
const duplicate=new DuplicateSourceError('a'.repeat(64),{name:'BandPhoto_2026_09_14.jpg',status:'ready'});
const render=(result,error='')=>renderToStaticMarkup(React.createElement(UploadFeedback,{result,error,notice:'',busy:false,onDismiss:noop,onRetry:noop,onExisting:noop,onContinue:noop,onRefresh:noop}));
test('duplicate identifies the existing source even when its filename differs',()=>{
 assert.equal(duplicate.existing.name,'BandPhoto_2026_09_14.jpg');assert.match(duplicate.message,/파일명이 달라도 내용이 같아/);
 const html=render({uploaded:6,duplicates:2,failed:0,lastId:'b',issues:[{name:'김규동 9/11.jpg',message:duplicate.message,existing:duplicate.existing}]});
 assert.match(html,/김규동 9\/11.jpg/);assert.match(html,/BandPhoto_2026_09_14.jpg/);assert.match(html,/기존 파일 열기/);assert.match(html,/2개 중복/);assert.doesNotMatch(html,/2개 업로드 실패/);assert.doesNotMatch(html,/<dialog/);
});
test('archived sources explain hidden original, without offering a broken open action',()=>{
 const error=new DuplicateSourceError('a',{name:'기존.jpg',status:'ready',originalRemoved:true});
 const html=render({uploaded:0,duplicates:1,failed:0,lastId:'',issues:[{name:'새 이름.jpg',message:error.message,existing:error.existing}]});
 assert.match(html,/원본은 정리됐지만 연결된 기록이 남아/);assert.doesNotMatch(html,/기존 파일 열기|업로드한 0개/);
});
test('mixed results preserve failure reasons and offer retry only for failures',()=>{
 const html=render({uploaded:6,duplicates:1,failed:1,lastId:'a',issues:[{name:'실패.jpg',message:'인터넷 연결을 확인해주세요.'}]});
 assert.match(html,/실패한 1개만 다시 시도/);assert.match(html,/인터넷 연결/);assert.match(html,/role="alert"/);assert.match(html,/업로드한 6개 기록 보기/);
 assert.equal(uploadSummaryText({uploaded:6,duplicates:1,failed:1}),'6개 업로드 완료 · 1개 중복 · 추가 안 함 · 1개 업로드 실패');
});
test('other file errors have a visible dismissible alert',()=>{
 const html=render(null,'한 번에 최대 10개까지 첨부할 수 있어요.');
 assert.match(html,/파일 처리 알림 닫기/);assert.match(html,/최대 10개/);assert.match(html,/목록 새로고침/);
});
