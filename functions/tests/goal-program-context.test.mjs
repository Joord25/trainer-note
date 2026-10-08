import {test} from 'node:test';
import assert from 'node:assert/strict';
import {goalProgramContext} from '../goal-program-context.mjs';
import {COACHING_SOURCES,COACHING_EVIDENCE_VERSION,goalCoachingReference} from '../coaching-evidence.mjs';
import {withTrainingGuidance,trainingGuidanceVersion} from '../training-guidance.mjs';
const row=(id,date,patch={})=>({id,date,exerciseName:'스쿼트',bodyPart:'하체',measurementType:'repetitions',loadType:'weighted',sets:[{kg:20,reps:5}],...patch});
test('28 days anchored to last record, calendar weeks without inventing missing activity or mutating input',()=>{
 const rows=[row('end','2026-10-09'),row('old','2026-09-11'),row('boundary','2026-09-12'),row('sunday','2026-10-04'),row('monday','2026-10-05'),row('invalid','2026-02-30')],before=JSON.stringify(rows),c=goalProgramContext(rows);
 assert.deepEqual(c.window,{from:'2026-09-12',to:'2026-10-09',anchor:'latest-record',days:28});
 assert.deepEqual(c.weeks.map(w=>w.weekStart),['2026-09-07','2026-09-28','2026-10-05']);
 assert.equal(c.observed.recordedDays,4);assert.equal(c.completeWeeklyActivityKnown,false);assert.equal(JSON.stringify(rows),before);
 assert.equal(goalProgramContext([]).window,null);assert.deepEqual(goalProgramContext([]).weeks,[]);
});
test('core and loaded walking distance stay distinct from cardio; partial time remains partial',()=>{
 const rows=[row('core','2026-10-05',{exerciseName:'에어 바이크',bodyPart:'코어',sets:[{kg:null,reps:30}]}),row('carry','2026-10-05',{exerciseName:'워킹 런지',measurementType:'weight_distance',sets:[{kg:4,reps:0,distanceMeters:160}]}),row('cardio','2026-10-05',{exerciseName:'러닝머신',bodyPart:'유산소',measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:60},{kg:null,reps:0}]})];
 const c=goalProgramContext(rows).observed;
 assert.equal(c.cardio.knownSeconds,60);assert.equal(c.cardio.missingTimeSegments,1);assert.equal(c.cardio.intensityVerified,false);assert.deepEqual(c.cardio.recordIds,['cardio']);
 assert.equal(c.primaryParts.find(p=>p.part==='하체').otherSegments,1);assert.equal(c.primaryParts.find(p=>p.part==='코어').repetitionSets,1);
 const unknown=goalProgramContext([row('u','2026-10-05',{bodyPart:'유산소',sets:[{kg:null,reps:50}]})]);assert.equal(unknown.observed.cardio.knownSeconds,null);assert.equal(unknown.observed.primaryParts.length,0);
});
test('low repetition is an observation per performed side, not summed reps or relative load',()=>{
 const c=goalProgramContext([row('x','2026-10-05',{sets:[{kg:20,reps:8,leftReps:4,rightReps:4},{kg:20,reps:4,leftReps:0,rightReps:4},{kg:20,reps:0},{kg:20,reps:12},{kg:20,reps:14,leftReps:4,rightReps:10}]})]).observed;
 assert.deepEqual(c.lowRepetitionRecords,[{recordId:'x',setNumbers:[1,2],relativeIntensityKnown:false}]);
});
test('curated evidence is traceable and scoped to member change and plan calls',()=>{
 assert.equal(new Set(COACHING_SOURCES.map(s=>s.id)).size,11);
 for(const s of COACHING_SOURCES){assert.equal(new URL(s.url).protocol,'https:');assert(s.claim&&s.limit&&s.population&&s.reviewedAt);assert(['full-text','abstract','official-summary','official-page'].includes(s.reviewed));}
 assert(goalCoachingReference().length<6500);
 for(const kind of ['member-changes','cycle-plan']){const input={system:'original',schema:{},parts:[],maxOutputTokens:6000},out=withTrainingGuidance(kind,input);assert(out.system.includes(COACHING_EVIDENCE_VERSION));assert.equal(out.schema,input.schema);assert.equal(out.parts,input.parts);assert.equal(input.system,'original');assert(trainingGuidanceVersion(kind).includes(COACHING_EVIDENCE_VERSION));}
 for(const kind of ['assistant-chat','extraction','assessment'])assert(!withTrainingGuidance(kind,{system:''}).system.includes(COACHING_EVIDENCE_VERSION));
});


test('observed volume uses only known weighted repetition sets, not bodyweight or distance work',()=>{
 const c=goalProgramContext([row('mixed','2026-10-05',{loadType:'mixed',sets:[{kg:null,reps:10},{kg:4,reps:12}]}),row('unknown','2026-10-05',{loadType:'unknown',sets:[{kg:null,reps:10}]}),row('carry','2026-10-05',{measurementType:'weight_distance',sets:[{kg:4,reps:0,distanceMeters:160}]})]).observed;
 assert.equal(c.repetitionSets,3);assert.deepEqual(c.weightedVolume,{kgRepetitions:48,knownLoadSets:1});
 assert.deepEqual(c.primaryParts[0].weightedVolume,c.weightedVolume);
 assert.equal(goalProgramContext([row('bw','2026-10-05',{loadType:'bodyweight',sets:[{kg:null,reps:10}]})]).observed.weightedVolume.kgRepetitions,null);
});

import {changeEvidence,prepareChangeRequest,validateChanges} from '../coaching-workflow.mjs';
test('goal interpretation requires personal evidence and allowlisted public sources; forged URLs never reach UI',()=>{
 const evidence=changeEvidence([row('x','2026-10-05')]),id=evidence[0].id;
 const value={goalReview:{summary:'기록된 하체 구성',reason:'목표와 기록의 관련성',nextStep:'같은 조건에서 확인',evidenceIds:[id],sourceIds:['KSSO2022'],references:[{url:'javascript:bad'}]},headline:'관찰',findings:[{evidenceId:id,interpretation:'기준 기록',uncertainty:'동일 조건 확인'}],directions:[{kind:'check',text:'수행 여유 확인',reason:'기준 기록 확인',check:'같은 조건에서 비교',evidenceIds:[id]}]};
 const out=validateChanges(value,evidence,{requireGoalReview:true});assert.equal(out.goalReview.references[0].url,'https://pmc.ncbi.nlm.nih.gov/articles/PMC10088549/');assert.equal(out.goalReview.references[0].type,'임상 진료지침');
 assert.throws(()=>validateChanges({...value,goalReview:null},evidence,{requireGoalReview:true}));
 assert.throws(()=>validateChanges({...value,goalReview:{...value.goalReview,nextStep:'다음 수업 999kg으로 증량'}},evidence));
 assert.equal(validateChanges({...value,goalReview:null},evidence).goalReview,null);
 assert.throws(()=>validateChanges({...value,goalReview:{...value.goalReview,evidenceIds:['foreign']}},evidence));
 assert.throws(()=>validateChanges({...value,goalReview:{...value.goalReview,sourceIds:['imaginary-paper']}},evidence));
 const prepared=prepareChangeRequest({evidence});assert.deepEqual(prepared.schema.properties.goalReview.properties.evidenceIds.items.enum,prepared.facts.evidence.map(e=>e.id));
 const restored=prepared.restore({...value,goalReview:{...value.goalReview,evidenceIds:[prepared.facts.evidence[0].id]}});assert.equal(restored.goalReview.evidenceIds[0],id);
});
