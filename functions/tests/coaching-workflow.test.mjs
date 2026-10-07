import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeEvidence,validateChanges,cycleOptions,validateCycle} from '../coaching-workflow.mjs';
const row=(id,date,exerciseName,kg,reps,bodyPart='하체')=>({id,date,exerciseName,bodyPart,loadType:'weighted',sets:reps.map(reps=>({kg,reps})),notes:''});
export const sample=[row('s1','2026-06-20','고블릿 스쿼트',12,[10,10,10]),row('s2','2026-09-02','고블릿 스쿼트',6,[10,10,12]),row('s3','2026-10-03','고블릿 스쿼트',8,[12,12,12]),row('r1','2026-06-30','시티드 로우',14.5,[15,15],'등'),row('r2','2026-09-30','시티드 로우',14.5,[12,12,12],'등')];
test('earlier evidence reverses overall squat trend while recent recovery stays visible',()=>{const evidence=changeEvidence(sample),s=evidence.find(e=>e.name==='고블릿 스쿼트'&&e.metric==='volume');assert.deepEqual(s.points.map(p=>p.value),[360,192,288]);assert.equal(s.overall.percent,-20);assert.equal(s.recent.percent,50);assert.equal(s.peak.date,'2026-06-20');});
test('row total volume gain survives changed set count and is not muscle gain',()=>{const evidence=changeEvidence(sample),e=evidence.find(e=>e.name==='시티드 로우'&&e.metric==='volume');assert.equal(e.overall.percent,20);const report=validateChanges({headline:'총운동량 변화',findings:[{evidenceId:e.id,interpretation:'세트 추가에 따른 총량 증가',uncertainty:'같은 기구인지 확인 필요'}],directions:[{kind:'check',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'기구와 자세 확인',evidenceIds:[e.id]}]},evidence);assert.equal(report.findings[0].interpretation,'세트 추가에 따른 총량 증가');assert.match(e.observation,/20%/);});
test('cardio stays separate; unknown load does not become zero volume; repeated sources show composition',()=>{const rows=[...sample,{...sample[0],id:'u',date:'2026-10-04',loadType:'unknown',sets:[{kg:null,reps:12}]},{id:'c',date:'2026-10-04',exerciseName:'인터벌',bodyPart:'유산소',measurementType:'incline_speed_time',loadType:'unknown',sets:[{kg:null,reps:0,inclinePercent:20,speedKph:5,durationSeconds:60},{kg:null,reps:0,inclinePercent:0,speedKph:3,durationSeconds:60}]},row('r3','2026-09-30','바벨 로우',12.5,[10,10,10],'등')];const e=changeEvidence(rows);assert.equal(e.find(e=>e.name==='고블릿 스쿼트'&&e.metric==='volume').points.length,3);assert(!e.some(e=>e.name==='인터벌'&&e.metric==='volume'));assert.equal(e.find(e=>e.name==='인터벌'&&e.metric==='speed').points[0].value,4);assert(e.some(e=>e.label==='유사 동작 집중'));});
test('foreign findings and duplicate evidence cannot enter a report',()=>{const e=changeEvidence(sample),v={headline:'변화',findings:[{evidenceId:'other',interpretation:'해석',uncertainty:'확인'}],directions:[{kind:'check',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'확인',evidenceIds:[e[0].id]}]};assert.throws(()=>validateChanges(v,e));v.findings=[{evidenceId:e[0].id,interpretation:'해석',uncertainty:'확인'},{evidenceId:e[0].id,interpretation:'해석',uncertainty:'확인'}];assert.throws(()=>validateChanges(v,e));});
const options=cycleOptions({count:4,frequency:2,minutes:50,equipment:'',directions:[{id:'direction-1',text:'기본 동작 유지'}]});
const candidate={id:'a',exerciseName:'스쿼트',measurementType:'repetitions',loadType:'weighted',referenceSegments:[{kg:8,reps:12}]};
const valid=()=>({title:'4회 계획',sessions:Array.from({length:4},(_,i)=>({number:i+1,focus:'기본 동작',progressWhen:'같은 자세와 회복 확인 후',adjustWhen:'피로가 크면 유지',checks:['수행 여유 기록'],items:[{candidateId:'a',reason:'선택한 방향',recovery:'',segments:[{kg:8,reps:12,durationSeconds:null,leftReps:null,rightReps:null}]}]}))});
test('cycle count, references, units and source values remain distinct',()=>{const plan=validateCycle(valid(),[candidate],options);assert.equal(plan.sessions.length,4);assert.deepEqual(plan.sessions[0].items[0].referenceSegments,[{kg:8,reps:12}]);const invalid=valid();invalid.sessions[0].items[0].segments[0].durationSeconds=60;assert.throws(()=>validateCycle(invalid,[candidate],options));assert.throws(()=>validateCycle({...valid(),sessions:valid().sessions.slice(0,3)},[candidate],options));invalid.sessions[0].items[0].candidateId='foreign';assert.throws(()=>validateCycle(invalid,[candidate],options));assert.throws(()=>cycleOptions({...options,count:5}));});

test('single-day interpretation cannot claim improvement and muscle growth claims are rejected',()=>{const e=changeEvidence([sample[0]]),value={headline:'기록 확인',findings:[{evidenceId:e[0].id,interpretation:'향상되었습니다',uncertainty:''}],directions:[{kind:'check',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'동일 조건 기록',evidenceIds:[e[0].id]}]};assert.match(validateChanges(value,e).findings[0].interpretation,/단일 날짜/);value.findings[0].interpretation='근육 성장이 확인됩니다';assert.throws(()=>validateChanges(value,e));});

test('invalid supplementary regional comments are omitted without losing validated changes',()=>{const evidence=changeEvidence(sample),e=evidence.find(e=>e.name==='고블릿 스쿼트'&&e.metric==='volume');assert.equal(e.bodyPart,'하체');const v={headline:'최근 회복',regionalComments:[{region:'하체',comment:'최근 수행량이 회복됐지만 초기보다 낮습니다.',evidenceIds:[e.id]}],findings:[{evidenceId:e.id,interpretation:'수행량 변화',uncertainty:'조건 확인'}],directions:[{kind:'check',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'수행 여유 확인',evidenceIds:[e.id]}]};assert.equal(validateChanges(v,evidence).regionalComments[0].region,'하체');v.regionalComments[0].region='상체';const partial=validateChanges(v,evidence);assert.equal(partial.regionalComments.length,0);assert.equal(partial.findings.length,1);assert.equal(partial.directions.length,1);assert.equal(partial.warnings.length,1);v.regionalComments[0].region='하체';v.regionalComments[0].comment='근육 성장이 확인됩니다';assert.equal(validateChanges(v,evidence).regionalComments.length,0);});

// Large random identifier enums can be rejected by Gemini before generation.
test('change schema stays bounded while server validation rejects unknown evidence IDs',async()=>{
 const {changeSchema}=await import('../coaching-workflow.mjs');
 const many=Array.from({length:250},(_,i)=>({id:`evidence-${i}`}));
 const small=JSON.stringify(changeSchema(many.slice(0,1))),large=JSON.stringify(changeSchema(many));
 assert.equal(large,small);
 assert.throws(()=>validateChanges({headline:'관찰',findings:[{evidenceId:'foreign',interpretation:'관찰',uncertainty:'조건 미상'}],directions:[{kind:'check',reason:'기록된 수행 변화에 따라 비교가 필요합니다.',check:'같은 기구와 중량에서 반복수를 기록해 비교합니다.',text:'확인',evidenceIds:['evidence-0']}]},many),/근거/);
});

test('directions preserve member-specific reason and reassessment criteria and reject missing fields',()=>{
 const evidence=changeEvidence(sample),e=evidence.find(e=>e.name==='고블릿 스쿼트'&&e.metric==='volume');
 const v={headline:'최근 수행량 회복',findings:[{evidenceId:e.id,interpretation:'초기보다 낮지만 직전보다 증가',uncertainty:'동일 조건 확인'}],directions:[{kind:'measure',text:'고블릿 스쿼트의 같은 중량에서 반복수와 수행 여유를 기록합니다.',reason:'최근 볼륨은 192에서 288로 늘었으나 초기 360보다 낮습니다.',check:'같은 기구·중량·가동 범위에서 반복수와 수행 여유를 비교합니다.',evidenceIds:[e.id]}]};
 const d=validateChanges(v,evidence).directions[0];assert.equal(d.reason,v.directions[0].reason);assert.equal(d.check,v.directions[0].check);
 assert.throws(()=>validateChanges({...v,directions:[{...v.directions[0],reason:''}]},evidence));
 assert.throws(()=>validateChanges({...v,directions:[{...v.directions[0],check:undefined}]},evidence));
 assert.throws(()=>validateChanges({...v,directions:[{...v.directions[0],evidenceIds:['foreign']}]},evidence));
});

test('compact evidence choices round-trip references without rewriting prose or record IDs',async()=>{
 const {prepareChangeRequest}=await import('../coaching-workflow.mjs');const evidence=changeEvidence(sample),id=evidence[0].id;
 const request=prepareChangeRequest({records:sample,evidence},[id]);assert.equal(request.facts.evidence[0].id,'E001');assert.equal(request.facts.records[0].id,'s1');
 assert.deepEqual(request.facts.overviewEvidenceIds,['E001']);assert.equal(request.schema.properties.findings.items.properties.evidenceId.enum[0],'E001');
 const restored=request.restore({findings:[{evidenceId:'E001',interpretation:'E001'}],directions:[{evidenceIds:['E001','unknown']}],regionalComments:[{evidenceIds:['E001']}]});
 assert.equal(restored.findings[0].evidenceId,id);assert.equal(restored.findings[0].interpretation,'E001');assert.deepEqual(restored.directions[0].evidenceIds,[id,'unknown']);assert.deepEqual(restored.regionalComments[0].evidenceIds,[id]);
});


test('regional allowlists exclude unclassified evidence and mismatched comments never gain substitute references',async()=>{
 const {prepareChangeRequest}=await import('../coaching-workflow.mjs');const evidence=changeEvidence(sample);
 const lower=evidence.find(e=>e.bodyPart==='하체'),upper=evidence.find(e=>e.bodyPart==='등');
 const request=prepareChangeRequest({evidence:[lower,upper,{id:'unclassified',name:'혼합 동작'}]});
 assert.deepEqual(request.facts.regionalEvidenceIds.하체,['E001']);assert.deepEqual(request.facts.regionalEvidenceIds.상체,['E002']);
 const valid={headline:'수행량 변화',findings:[{evidenceId:lower.id,interpretation:'수행량 비교',uncertainty:'조건 확인'}],directions:[{kind:'check',text:'같은 조건 확인',reason:'수행량 변화',check:'반복수 확인',evidenceIds:[lower.id]}]};
 const result=validateChanges({...valid,regionalComments:[{region:'하체',comment:'혼합 근거 의견',evidenceIds:[lower.id,upper.id]},{region:'상체',comment:'등 기록 비교',evidenceIds:[upper.id]},{region:'코어',comment:'없는 근거',evidenceIds:['foreign']}]},evidence);
 assert.deepEqual(result.regionalComments,[{region:'상체',comment:'등 기록 비교',evidenceIds:[upper.id]}]);
 assert.equal(result.warnings.length,1);assert.equal(result.findings.length,1);
});


test('cycle empty placeholders normalize but incompatible measurements remain rejected',async()=>{
 const {normalizeCycleSegment}=await import('../coaching-workflow.mjs');
 const weighted={measurementType:'repetitions',loadType:'weighted'};
 assert.deepEqual(normalizeCycleSegment({kg:8,reps:12,leftReps:0,rightReps:0,durationSeconds:0,distanceMeters:null,inclinePercent:0,speedKph:null},weighted),{kg:8,reps:12});
 const cardio={measurementType:'incline_speed_time',loadType:'unknown'};
 assert.deepEqual(normalizeCycleSegment({kg:0,reps:null,leftReps:0,rightReps:0,distanceMeters:0,durationSeconds:60,inclinePercent:0,speedKph:3},cardio),{kg:null,reps:0,durationSeconds:60,inclinePercent:0,speedKph:3});
 const v=valid();v.sessions[0].items[0].segments[0]={kg:8,reps:12,leftReps:0,rightReps:0,durationSeconds:0};
 assert.equal(validateCycle(v,[candidate],options).sessions[0].items[0].segments[0].reps,12);
 v.sessions[0].items[0].segments[0].durationSeconds=60;
 assert.throws(()=>validateCycle(v,[candidate],options),/1회 수업 · 스쿼트 1번째/);
 v.sessions[0].items[0].segments[0]={kg:8,reps:12,leftReps:6,rightReps:0};assert.throws(()=>validateCycle(v,[candidate],options));
 v.sessions[0].items[0].segments[0]={kg:0,reps:12};assert.throws(()=>validateCycle(v,[candidate],options));
});

test('cardio plans retain zero incline and reject missing duration or a weighted interval',()=>{
 const c={...candidate,exerciseName:'인터벌',measurementType:'incline_speed_time',loadType:'unknown'};
 const v=valid();for(const session of v.sessions)session.items[0].segments=[{kg:null,reps:null,durationSeconds:60,inclinePercent:0,speedKph:3,leftReps:0,rightReps:0,distanceMeters:0}];
 assert.equal(validateCycle(v,[c],options).sessions[0].items[0].segments[0].inclinePercent,0);
 v.sessions[0].items[0].segments[0].durationSeconds=null;assert.throws(()=>validateCycle(v,[c],options));
 v.sessions[0].items[0].segments[0].durationSeconds=60;v.sessions[0].items[0].segments[0].kg=8;assert.throws(()=>validateCycle(v,[c],options));
});
