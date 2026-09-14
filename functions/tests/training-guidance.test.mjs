import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withTrainingGuidance,TRAINING_GUIDANCE,TRAINING_GUIDANCE_VERSION,TRAINING_GUIDANCE_SOURCES} from '../training-guidance.mjs';
import {cardioDistribution,isCardioWorkout} from '../generated/cardio-distribution.mjs';
import {summarize} from '../domain.mjs';
import {progressStats} from '../generated/training-goals.mjs';
const row=(name,patch={})=>({date:'2026-09-14',exerciseName:name,bodyPart:'전신',loadType:'unknown',measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:60}],...patch});
test('known cardio names normalize spacing, without treating timed holds or strength rows as cardio',()=>{
 for(const name of ['마이 마운틴','로잉머신','스키 에르고미터','인터벌 러닝','트레드밀'])assert(isCardioWorkout(row(name)),name);
 for(const name of ['플랭크','바벨 로우','시티드 로우','바이시클 크런치','파머스 워크','에어 바이크','Air Bike'])assert(!isCardioWorkout(row(name)),name);
});
test('trainer part overrides naming and air bike abdominal work stays in core',()=>{
 const core=row('에어 바이크',{bodyPart:'코어',measurementType:'repetitions',loadType:'bodyweight',sets:[{kg:null,reps:50}]});
 assert.equal(isCardioWorkout(core),false);assert.equal(progressStats([core]).parts['코어'],1);
 assert.equal(isCardioWorkout(row('트레이너 지정 운동',{bodyPart:'유산소'})),true);
 assert.equal(isCardioWorkout(row('스키 에르고미터',{bodyPart:'코어'})),false);
});
test('cardio counts dates once, keeps missing time unknown and never converts repetitions to seconds',()=>{
 const records=[row('마이마운틴',{sets:[{kg:null,reps:0,durationSeconds:60},{kg:null,reps:0,durationSeconds:60}]}),row('로잉머신',{bodyPart:'유산소',measurementType:'repetitions',loadType:'bodyweight',sets:[{kg:null,reps:50}]}),row('플랭크')],before=JSON.stringify(records),c=cardioDistribution(records);
 assert.equal(c.days,1);assert.equal(c.segments,3);assert.equal(c.seconds,120);assert.equal(c.missingTime,1);assert.equal(JSON.stringify(records),before);
 assert.equal(cardioDistribution([records[1]]).seconds,null);assert.equal(cardioDistribution([]).days,0);
 const stats=progressStats([...records,row('스쿼트',{bodyPart:'하체',measurementType:'repetitions',loadType:'weighted',sets:[{kg:20,reps:10}]})]);
 const report=summarize([...records,row('스쿼트',{bodyPart:'하체',measurementType:'repetitions',loadType:'weighted',sets:[{kg:20,reps:10}]})]);assert.equal(report.sets,stats.sets);assert.equal(report.volume,stats.volume);assert.equal(report.cardio.segments,stats.cardio);assert.equal(report.cardio.seconds,120);
 assert.equal(stats.sets,1);assert.equal(stats.volume,200);assert.equal(stats.cardio,3);assert.deepEqual(stats.parts,{'하체':1});
});
test('guidance augments only analysis calls without mutating records, schema or request budgets',()=>{
 const request={system:'original',schema:{type:'object'},parts:[{text:'member facts'}],timeoutMs:1234};
 for(const kind of ['analysis-and-plan','goal-design','goal-visual','connected-lesson','assessment','assessment-review','assistant-chat']){
 const output=withTrainingGuidance(kind,request);assert.match(output.system,/최대근력/);assert.match(output.system,/근비대/);assert.match(output.system,/근지구력/);assert.match(output.system,/파워/);assert.equal(output.parts,request.parts);assert.equal(output.schema,request.schema);assert.equal(output.timeoutMs,1234);}
 for(const kind of ['extraction','assistant-web-search','search-safety'])assert.equal(withTrainingGuidance(kind,request),request);
 assert.equal(request.system,'original');assert(TRAINING_GUIDANCE.length<2500);assert(TRAINING_GUIDANCE.includes(TRAINING_GUIDANCE_VERSION));assert.equal(TRAINING_GUIDANCE_SOURCES.length,3);
});
