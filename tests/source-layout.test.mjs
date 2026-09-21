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
const {AnalysisSource,RecordReadingStatus}=require('../src/components/analysis-source.tsx');
const {SourceActions}=require('../src/components/source-actions.tsx');
const {ContinuousSourceViewer}=require('../src/components/continuous-source-viewer.tsx');
const file={id:'a'.repeat(64),name:'multi-date.png',status:'ready',contentType:'image/png',size:10,createdAt:null,pending:false};
const row=(id,date,sessionIndex)=>({id,sessionIndex,programSection:'W.O.D',review:'confirmed',issues:[],fileId:file.id,input:{date,sourceHash:file.id,sourceName:file.name,sourcePage:1,rawName:'squat',exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:20,reps:10}],notes:''}});
const noop=()=>{};
function render(rows,overrides={}){return renderToStaticMarkup(React.createElement(AnalysisSource,{memberId:'m',memberName:'회원',online:true,files:[file],imports:[],rows,selectedFile:file.id,selectedRow:'',onFile:noop,onRow:noop,onUpload:noop,onDirty:noop,recordsOnly:true,...overrides}));}
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
test('record selector scopes cards, selection and export to the chosen original',()=>{
 const other={...file,id:'b'.repeat(64),name:'application.jpg',originalRemoved:true};
 const otherRow={...row('other','2026-02-01',1),fileId:other.id,input:{...row('other','2026-02-01',1).input,sourceHash:other.id,exerciseName:'다른 파일 운동'}};
 const rows=[row('first','2026-01-21',1),otherRow],files=[other,file];
 const html=render(rows,{files});assert.ok(!html.includes('다른 파일 운동'));assert.equal((html.match(/data-record-file=/g)||[]).length,1);
 const all=render(rows,{files,selectedFile:'all'});assert.match(all,/다른 파일 운동/);assert.equal((all.match(/data-record-file=/g)||[]).length,2);
 assert.match(html,/AI로 다시 판독/);assert.ok(!html.includes('>다시 생성</button>'));assert.ok(!html.includes('class="bulk-selection-bar"'));
});

test('archived unparsed-only cards can be deleted and cleared interpretations no longer render',()=>{
 const archived={...file,originalRemoved:true};
 const data={id:file.id,status:'ready',revision:1,rows:[],unparsed:[{page:1,text:'가입신청서',reason:'운동 기록 없음'}]};
 const html=render([],{files:[archived],imports:[data]});
 assert.match(html,/판독·운동 기록 전체 삭제/);assert.match(html,/가입신청서/);
 const cleared=render([],{imports:[{...data,unparsed:[],recordsDeleted:true}]});
 assert.ok(!cleared.includes('data-record-page='));
});

test('reading guidance provides supported actions and renders model text safely',()=>{
 const html=render([],{imports:[{id:file.id,status:'ready',revision:1,rows:[],unparsed:[],guidance:{summary:'<script>alert(1)</script> 손글씨 일지',checks:['1/13 수정 중량 확인'],uploadAdvice:'날짜가 보이도록 촬영해주세요.'}}]});
 assert.match(html,/AI 판독 안내/);assert.match(html,/직접 운동 추가/);assert.match(html,/보완한 일지 업로드/);
 assert.match(html,/1\/13 수정 중량 확인/);assert.ok(!html.includes('<script>'));
});


test('undosed date cards show missing measurements rather than invented one-set chips',()=>{
 const rows=[row('first','2026-01-13',1),row('second','2026-01-21',2)].map(r=>({...r,review:'needs-review',input:{...r.input,sets:[]}}));
 const html=render(rows);
 assert.equal((html.match(/data-record-page="1"/g)||[]).length,2);
 assert.equal((html.match(/aria-label="세트 정보 미기록"/g)||[]).length,2);
 assert.ok(!html.includes('aria-label="1세트"'));
 assert.match(html,/2026-01-13 수업/);assert.match(html,/2026-01-21 수업/);
});


test('record list replaces duplicate checklist and missing values are not action warnings',()=>{
 const rows=[row('first','2026-01-13',1),row('second','2026-01-17',2)].map(r=>({...r,review:'needs-review',issues:['세트 미기록']}));
 const data={id:file.id,status:'ready',revision:1,rows,unparsed:[{page:1,text:'1/21 이후 기록',reason:'본 JSON에 포함되지 않음'}]};
 const html=render(rows,{imports:[data]});
 assert.ok(!html.includes('파일 전체 확인할 내용'));assert.match(html,/<details class="record-review-details"><summary>판독 상세/);assert.match(html,/확인 필요한 항목만 보기/);
 assert.equal((html.match(/수정 필요 1개/g)||[]).length,0);
 assert.ok(!html.includes('판독 완료'));assert.ok(!html.includes('일부 판독 · 미반영 내용 있음'));
 assert.match(html,/2026-01-17 수업/);assert.match(html,/미반영 원문 1개/);
});
test('reading and completion status use a full-pane overlay with a dismissible result',()=>{
 const renderStatus=props=>renderToStaticMarkup(React.createElement(RecordReadingStatus,{onDismiss:noop,...props}));
 const busy=renderStatus({busy:true,success:false,message:'원본을 다시 판독하고 있어요…'});
 assert.match(busy,/record-reading-overlay/);assert.match(busy,/role="status"/);assert.ok(!busy.includes('<button'));
 const done=renderStatus({busy:false,success:true,message:'재판독 결과를 불러왔어요.'});assert.match(done,/>확인<\/button>/);
 assert.equal(renderStatus({busy:false,success:false,message:''}),'');
});


test('coverage shows omitted dates, unreadable regions and original text without inventing workout cards',()=>{
 const coverage=[{page:1,sessionIndex:2,dateText:'1/21',rawText:'Lat pull down <script>bad()</script>',status:'unprocessed',reason:'미처리',expectedExercises:2,extractedExercises:0},{page:1,sessionIndex:3,dateText:'2/?',rawText:'',status:'unreadable',reason:'잘림',expectedExercises:0,extractedExercises:0}];
 const html=render([row('first','2026-01-13',1)],{imports:[{id:file.id,status:'ready',revision:1,rows:[],unparsed:[],coverage,promptVersion:'workout-v11-session-coverage'}]});
 assert.match(html,/날짜별 판독 현황 · 2개 영역/);assert.match(html,/1\/21 · 미처리 · 운동 0\/2개/);assert.match(html,/읽기 불가/);assert.ok(!html.includes('일부 판독 · 미반영 내용 있음'));assert.match(html,/<details><summary>날짜별 판독 현황/);assert.match(html,/판독 범위에 확인할 내용/);assert.ok(!html.includes('<script>'));assert.match(html,/workout-v11-session-coverage/);
 const deleted=render([],{imports:[{id:file.id,status:'ready',revision:2,rows:[],unparsed:[],coverage,recordsDeleted:true}]});assert.ok(!deleted.includes('날짜별 판독 현황'));
});
