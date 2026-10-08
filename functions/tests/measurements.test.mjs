import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validMeasurement,formatWorkoutSet,blankSet,convertWorkoutSets} from '../generated/workout-measurements.mjs';
import {parseExtraction} from '../generated/extraction.mjs';
import {validInput,classify,summarize,validateReport} from '../domain.mjs';
import {sameRecordInput} from '../record-sync.mjs';
const input={date:'2026-09-12',rawName:'sky erg',exerciseName:'스키에르그',bodyPart:'전신',loadType:'unknown',measurementType:'distance_time',sets:[{kg:null,reps:0,distanceMeters:200,durationSeconds:32},{kg:null,reps:0,distanceMeters:200,durationSeconds:34}],notes:'200m 소요 시간. 60초 휴식.',sourceHash:'a'.repeat(64),sourceName:'일지.png',sourcePage:1};
test('distance/time validates, formats, and never becomes weight volume',()=>{assert.equal(validMeasurement(input),true);assert.deepEqual(validInput(input),input);assert.equal(formatWorkoutSet(input,input.sets[0]),'200m / 32초');assert.equal(summarize([input]).volume,0);assert.equal(classify({input,issues:[]}).review,'auto');});
test('wrong units, missing values and invented repetition counts are rejected',()=>{for(const patch of [{loadType:'weighted'},{sets:[{kg:200,reps:32,distanceMeters:200,durationSeconds:32}]},{sets:[{kg:null,reps:0,distanceMeters:200}]},{sets:[{kg:null,reps:0,distanceMeters:-1,durationSeconds:32}]},{sets:[{kg:null,reps:0,distanceMeters:200,durationSeconds:Infinity}]},{measurementType:'repetitions'},{measurementType:'other'}])assert.equal(validMeasurement({...input,...patch}),false);});
test('duration-only, distance-only and legacy weighted records remain valid',()=>{assert.ok(validMeasurement({...input,measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:60}]}));assert.ok(validMeasurement({...input,measurementType:'distance',sets:[{kg:null,reps:0,distanceMeters:200}]}));assert.ok(validMeasurement({loadType:'weighted',sets:[{kg:20,reps:10}]}));});
test('SkiErg extraction preserves each interval and explicit units',async()=>{const raw={records:[{page:1,memberName:'회원',year:2026,month:9,day:12,rawName:'sky erg',exerciseName:'스키에르그',bodyPart:'전신',loadType:'unknown',measurementType:'distance_time',sets:input.sets.map(s=>({...s,reps:null})),notes:'',issues:[],components:[]}],unparsed:[]};const value=await parseExtraction(raw,{id:input.sourceHash,name:input.sourceName,contentType:'image/png'},'회원');assert.equal(value.records[0].input.measurementType,'distance_time');assert.deepEqual(value.records[0].input.sets,input.sets);assert.deepEqual(value.records[0].issues,[]);raw.records[0].sets[0].durationSeconds=null;const missing=await parseExtraction(raw,{id:input.sourceHash,name:input.sourceName,contentType:'image/png'},'회원');assert.ok(missing.records[0].issues.some(s=>s.includes('시간')));});
test('Firestore map key order does not generate a spurious row revision',()=>{const reorder=v=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().reverse().map(k=>[k,reorder(v[k])])):v;assert.notEqual(JSON.stringify(input),JSON.stringify(reorder(input)));assert.ok(sameRecordInput(input,reorder(input)));assert.equal(sameRecordInput(input,{...input,sets:[{...input.sets[0],durationSeconds:33}]}),false);});
test('L/R is one set, total repetitions drive volume and side values remain visible',()=>{const row={...input,rawName:'DB row',exerciseName:'덤벨 로우',bodyPart:'등',measurementType:'repetitions',loadType:'weighted',sets:[{kg:20,reps:18,leftReps:10,rightReps:8}]};assert.ok(validMeasurement(row));assert.deepEqual(validInput(row),row);assert.equal(summarize([row]).volume,360);assert.equal(summarize([row]).sets,1);assert.equal(formatWorkoutSet(row,row.sets[0]),'20kg × L 10회 / R 8회');assert.equal(formatWorkoutSet(row,{kg:20,reps:20,leftReps:10,rightReps:10}),'20kg × 좌우 각 10회');for(const set of [{kg:20,reps:10,leftReps:10,rightReps:8},{kg:20,reps:10,leftReps:10},{kg:20,reps:0,leftReps:0,rightReps:0},{kg:20,reps:10,leftReps:5.5,rightReps:4.5},{kg:20,reps:2010,leftReps:2000,rightReps:10}])assert.equal(validMeasurement({...row,sets:[set]}),false);assert.equal(validMeasurement({...input,sets:[{...input.sets[0],leftReps:10,rightReps:10}]}),false);});
test('L/R extraction calculates total from explicit sides and flags a missing side',async()=>{const source={id:input.sourceHash,name:input.sourceName,contentType:'image/png'};const raw={records:[{page:1,memberName:'회원',year:2026,month:9,day:12,rawName:'BB split sq LR10',exerciseName:'바벨 스플릿 스쿼트',bodyPart:'하체',loadType:'weighted',measurementType:'repetitions',sets:[{kg:20,reps:10,leftReps:10,rightReps:10}],notes:'LR10',issues:[],components:[]}],unparsed:[]};const result=await parseExtraction(raw,source,'회원');assert.deepEqual(result.records[0].input.sets,[{kg:20,reps:20,leftReps:10,rightReps:10}]);assert.deepEqual(result.records[0].issues,[]);raw.records[0].sets[0].rightReps=null;const missing=await parseExtraction(raw,source,'회원');assert.ok(missing.records[0].issues.some(s=>s.includes('L·R')));assert.equal(classify(missing.records[0]).review,'needs-review');});


const mountain={...input,rawName:'마이마운틴',exerciseName:'마이마운틴 인터벌',measurementType:'incline_speed_time',sets:[{kg:null,reps:0,inclinePercent:20,speedKph:5,durationSeconds:60},{kg:null,reps:0,inclinePercent:0,speedKph:3,durationSeconds:60}]};
test('incline/speed/time persists explicit units, zero grade and stopped recovery without volume',()=>{
 assert.equal(validMeasurement({...mountain,sets:[{...mountain.sets[0],inclinePercent:-5}]}),true);assert.equal(validMeasurement(mountain),true);assert.deepEqual(validInput(mountain),mountain);
 assert.equal(formatWorkoutSet(mountain,mountain.sets[1]),'경사 0% · 3km/h · 60초');
 assert.equal(summarize([mountain]).volume,0);
 assert.equal(validMeasurement({...mountain,sets:[{...mountain.sets[1],speedKph:0}]}),true);
 for(const patch of [{inclinePercent:null},{inclinePercent:-101},{inclinePercent:101},{speedKph:NaN},{speedKph:101},{durationSeconds:0},{distanceMeters:100},{kg:20},{reps:10},{leftReps:10}])assert.equal(validMeasurement({...mountain,sets:[{...mountain.sets[0],...patch}]}),false);
 assert.equal(validMeasurement({...mountain,measurementType:'duration'}),false);
});
test('changing from time-only keeps times and leaves unknown incline/speed blank',()=>{
 const sets=convertWorkoutSets([{kg:null,reps:0,durationSeconds:60},{kg:null,reps:0,durationSeconds:120}],'incline_speed_time');
 assert.deepEqual(sets,[{...blankSet('incline_speed_time'),durationSeconds:60},{...blankSet('incline_speed_time'),durationSeconds:120}]);
 assert.deepEqual(convertWorkoutSets(mountain.sets,'duration'),mountain.sets.map(s=>({kg:null,reps:0,durationSeconds:s.durationSeconds})));
});
test('incline extraction retains zero grade and flags missing units without inventing load',async()=>{
 const source={id:input.sourceHash,name:input.sourceName,contentType:'image/png'};
 const raw={records:[{page:1,memberName:'회원',year:2026,month:9,day:12,...mountain,sets:mountain.sets.map(s=>({...s,reps:null})),notes:'',issues:[],components:[]}],unparsed:[]};
 const result=await parseExtraction(raw,source,'회원');assert.deepEqual(result.records[0].input.sets,mountain.sets);assert.deepEqual(result.records[0].issues,[]);
 raw.records[0].sets[0].inclinePercent=null;
 const pending=await parseExtraction(raw,source,'회원');assert.ok(pending.records[0].issues.some(v=>v.includes('경사(%)')));assert.equal(classify(pending.records[0]).review,'needs-review');
});

test('reading guidance is bounded, optional for old results, and cannot discard readable exercises',async()=>{
 const source={id:input.sourceHash,name:input.sourceName,contentType:'image/png'};
 const raw={records:[{page:1,memberName:'회원',year:null,month:1,day:13,sessionIndex:1,rawName:'TRX squat',exerciseName:'TRX 스쿼트',bodyPart:'하체',loadType:'unknown',sets:[],notes:'',issues:['횟수 미기록']}],unparsed:[],guidance:{summary:'손글씨의 날짜별 운동을 읽었습니다.',checks:['연도를 확인해주세요.','1/13 중량 표기를 확인해주세요.',4,'약어 확인','추가 질문'],uploadAdvice:'',action:'deleteAll'}};
 const result=await parseExtraction(raw,source,'회원');
 assert.equal(result.records.length,1);assert.equal(result.records[0].input.date,'');
 assert.equal(result.guidance.checks.length,3);assert.equal(result.guidance.action,undefined);
 delete raw.guidance;assert.equal((await parseExtraction(raw,source,'회원')).guidance,undefined);
 raw.guidance={summary:4};assert.equal((await parseExtraction(raw,source,'회원')).records.length,1);
});


test('undosed exercises retain independent sessions without invented sets or duplicate measurement warnings',async()=>{
 const source={id:input.sourceHash,name:input.sourceName,contentType:'image/png'};
 const records=[13,21,26].map((day,i)=>({page:1,memberName:'회원',year:2026,month:1,day,sessionIndex:i+1,rawName:'TRX squat',exerciseName:'TRX 스쿼트',bodyPart:'하체',loadType:'unknown',sets:[],notes:'',issues:[]}));
 const parsed=await parseExtraction({records,unparsed:[]},source,'회원');
 assert.deepEqual(parsed.records.map(r=>r.input.date),['2026-01-13','2026-01-21','2026-01-26']);
 assert.equal(new Set(parsed.records.map(r=>r.id)).size,3);
 for(const row of parsed.records){assert.deepEqual(row.input.sets,[]);const checked=classify(row);assert.equal(checked.review,'needs-review');assert.equal(checked.issues.length,1);assert.match(checked.issues[0],/미기록/);assert.throws(()=>validInput(row.input));}
 assert.equal(summarize(parsed.records.map(r=>r.input)).sets,0);
 records[0].loadType='weighted';records[0].sets=[{kg:25,reps:null}];
 const partial=await parseExtraction({records,unparsed:[]},source,'회원');
 assert.equal(partial.records[0].input.sets[0].kg,25);assert.equal(classify(partial.records[0]).review,'needs-review');
});

test('duplicate strength fields in a timed row remain reviewable without losing the rest of the page',async()=>{
 const source={id:input.sourceHash,name:input.sourceName,contentType:'image/png'};
 const common={page:1,memberName:'회원',year:2026,month:9,day:12,sessionIndex:1,notes:'',issues:[],components:[]};
 const strength={...common,rawName:'squat',exerciseName:'스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:16,reps:10}]};
 const timed={...common,rawName:'interval',exerciseName:'인터벌',bodyPart:'유산소',loadType:'weighted',measurementType:'duration',sets:[{kg:20,reps:5,durationSeconds:60}]};
 const raw={records:[strength,timed],unparsed:[]};
 const parsed=await parseExtraction(raw,source,'회원');
 assert.equal(parsed.records.length,2);assert.equal(classify(parsed.records[0]).review,'auto');
 assert.equal(classify(parsed.records[1]).review,'needs-review');
 assert.deepEqual(parsed.records[1].input.sets,[{kg:null,reps:0,durationSeconds:60}]);
 assert.equal(parsed.records[1].input.loadType,'unknown');
 assert.match(parsed.records[1].input.notes,/kg=20/);assert.match(parsed.records[1].input.notes,/reps=5/);
 assert.deepEqual(raw.records[1].sets,[{kg:20,reps:5,durationSeconds:60}]);
 assert.equal(summarize(parsed.records.map(r=>r.input)).volume,160);
});

test('crossed measurement channels preserve candidates as notes and require review',async()=>{
 const common={page:1,memberName:'회원',year:2026,month:9,day:12,rawName:'walk',exerciseName:'걷기',bodyPart:'하체',loadType:'unknown',notes:'',issues:[],components:[]};
 for(const patch of [
  {measurementType:'incline_speed_time',sets:[{kg:null,reps:null,inclinePercent:0,speedKph:3,durationSeconds:60,distanceMeters:50}]},
  {measurementType:'distance',sets:[{kg:4,reps:null,distanceMeters:40,durationSeconds:60}]},
  {measurementType:'duration',sets:[{kg:null,reps:null,durationSeconds:60,inclinePercent:20,speedKph:5}]},
  {loadType:'weighted',measurementType:'repetitions',sets:[{kg:4,reps:10,distanceMeters:40}]}
 ]){
  const parsed=await parseExtraction({records:[{...common,...patch}],unparsed:[]},{id:input.sourceHash,name:input.sourceName,contentType:'image/png'},'회원');
  assert.equal(classify(parsed.records[0]).review,'needs-review');assert.match(parsed.records[0].input.notes,/판독/);
 }
});

test('per-set transcription preserves an unknown-load column and distance units',async()=>{
 const row={page:1,memberName:'회원',year:2026,month:9,day:12,rawName:'loaded walk',exerciseName:'걷기',bodyPart:'하체',loadType:'unknown',measurementType:'distance',notes:'중량은 원문 참고',issues:['중량·거리 복합 기록 확인'],sets:[{sourceText:'kg: X / rep: 40m',kg:null,reps:null,distanceMeters:40},{sourceText:'kg: 6 / rep: 40m',kg:null,reps:null,distanceMeters:40}]};
 const parsed=await parseExtraction({records:[row],unparsed:[]},{id:input.sourceHash,name:input.sourceName,contentType:'image/png'},'회원');
 assert.equal(parsed.records[0].input.sets.length,2);
 assert.match(parsed.records[0].input.notes,/1세트 원문: kg: X \/ rep: 40m/);
 assert.match(parsed.records[0].input.notes,/2세트 원문: kg: 6/);
 assert.equal(classify(parsed.records[0]).review,'needs-review');
 assert.equal(summarize(parsed.records.map(r=>r.input)).volume,0);
});

test('weight-distance retains load and distance without repetition volume',async()=>{
 const row={...input,measurementType:'weight_distance',loadType:'weighted',sets:[{kg:0,reps:0,distanceMeters:40},{kg:6,reps:0,distanceMeters:40}]};
 assert.ok(validMeasurement(row));assert.deepEqual(validInput(row),row);
 assert.equal(formatWorkoutSet(row,row.sets[1]),'6kg · 40m');assert.equal(summarize([row]).volume,0);
 assert.deepEqual(convertWorkoutSets(input.sets,'weight_distance'),input.sets.map(s=>({kg:null,reps:0,distanceMeters:s.distanceMeters})));
 for(const bad of [{kg:null},{kg:-1},{kg:2001},{kg:'6'},{distanceMeters:0},{distanceMeters:NaN},{reps:10},{durationSeconds:60},{leftReps:0,rightReps:10}])assert.equal(validMeasurement({...row,sets:[{...row.sets[1],...bad}]}),false);
 const raw={records:[{page:1,memberName:'회원',year:2026,month:9,day:12,rawName:'loaded carry',exerciseName:'캐리',bodyPart:'전신',measurementType:'weight_distance',loadType:'weighted',sets:row.sets,notes:'',issues:[]}],unparsed:[]};
 const parsed=await parseExtraction(raw,{id:input.sourceHash,name:input.sourceName,contentType:'image/png'},'회원');
 assert.deepEqual(parsed.records[0].input.sets,row.sets);assert.equal(classify(parsed.records[0]).review,'auto');
});
test('left-only and right-only repetitions keep zero visible and sum exactly once',async()=>{
 for(const [left,right] of [[0,10],[12,0]]){
  const row={...input,exerciseName:'덤벨 로우',bodyPart:'등',measurementType:'repetitions',loadType:'weighted',sets:[{kg:6,reps:left+right,leftReps:left,rightReps:right}]};
  assert.ok(validMeasurement(row));assert.equal(summarize([row]).volume,6*(left+right));
  assert.equal(formatWorkoutSet(row,row.sets[0]),`6kg × L ${left}회 / R ${right}회`);
  const raw={records:[{page:1,memberName:'회원',year:2026,month:9,day:12,rawName:'row',exerciseName:'로우',bodyPart:'등',loadType:'weighted',sets:row.sets,notes:'',issues:[]}],unparsed:[]};
  const parsed=await parseExtraction(raw,{id:input.sourceHash,name:input.sourceName,contentType:'image/png'},'회원');
  assert.equal(classify(parsed.records[0]).review,'auto');
 }
});
