import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validMeasurement,formatWorkoutSet} from '../generated/workout-measurements.mjs';
import {exerciseGroups,performanceDays} from '../generated/progress-analysis.mjs';
import {exerciseLoadContext} from '../load-context.mjs';
import {validInput,summarize} from '../domain.mjs';
import {changeEvidence} from '../coaching-workflow.mjs';
const r={id:'mix',date:'2026-10-08',rawName:'스쿼트',exerciseName:'스쿼트',bodyPart:'하체',loadType:'mixed',measurementType:'repetitions',sets:[{kg:null,reps:15},{kg:10,reps:12},{kg:20,reps:10}],sourceName:'',sourceHash:'',sourcePage:0,notes:'',origin:'manual',status:'confirmed'};
test('mixed input round trips and each set formats its actual load',()=>{
 const {id,origin,status,...input}=r;assert.equal(validInput({...input,sourceName:'일지.png',sourceHash:'a'.repeat(64),sourcePage:1}).loadType,'mixed');assert(validMeasurement(r));
 assert.equal(formatWorkoutSet(r,r.sets[0]),'맨몸 × 15회');assert.equal(formatWorkoutSet(r,r.sets[1]),'10kg × 12회');
 for(const kg of [0,-1,2001,'10',undefined])assert(!validMeasurement({...r,sets:[{kg,reps:10}]}));
 assert(!validMeasurement({...r,loadType:'bodyweight'}));assert(!validMeasurement({...r,loadType:'weighted'}));
 assert(!validMeasurement({...r,measurementType:'duration',sets:[{kg:null,reps:0,durationSeconds:60}]}));
});
test('mixed counts all sets and reps but only known kg contributes volume and weight',()=>{
 assert(exerciseGroups([r])[0].hasWeighted);assert.equal(performanceDays([r],'volume')[0].value,320);assert.equal(performanceDays([r],'kg')[0].value,20);assert.equal(performanceDays([r],'reps')[0].value,37);assert.equal(summarize([r]).volume,320);
 const day=exerciseLoadContext([r])[0].days[0];assert.equal(day.bodyweightSets,1);assert.equal(day.weightedSets,2);assert.equal(day.knownVolume,320);assert.equal(day.volumeCoverage,'partial');
 assert.equal(changeEvidence([r]).find(e=>e.metric==='volume').points[0].value,320);
 const bodyOnly={...r,sets:[{kg:null,reps:15}]};assert.equal(performanceDays([bodyOnly],'volume')[0].value,null);assert.equal(exerciseLoadContext([bodyOnly])[0].days[0].bodyweightSets,1);
});
