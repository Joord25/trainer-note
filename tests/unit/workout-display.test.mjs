import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
import {test,after} from 'node:test';
const dir=mkdtempSync(join(tmpdir(),'workout-display-'));
after(()=>rmSync(dir,{recursive:true,force:true}));
for(const name of ['workout-measurements','workout-display'])writeFileSync(join(dir,name+'.mjs'),ts.transpileModule(readFileSync(new URL('../../src/lib/'+name+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./workout-measurements'","'./workout-measurements.mjs'"));
const {repeatedWorkoutPattern}=await import(pathToFileURL(join(dir,'workout-display.mjs')));
const up={kg:null,reps:0,inclinePercent:20,speedKph:5,durationSeconds:60};
const down={kg:null,reps:0,inclinePercent:0,speedKph:3,durationSeconds:60};
const workout=sets=>({measurementType:'incline_speed_time',loadType:'unknown',sets});
test('six alternating segments display one cycle repeated three times without altering source data',()=>{
 const input=workout([up,down,{...up},{...down},{...up},{...down}]),before=JSON.stringify(input);
 assert.deepEqual(repeatedWorkoutPattern(input),{segments:[up,down],repeats:3,total:6});
 assert.equal(JSON.stringify(input),before);assert.equal(input.sets.length,6);
});
test('partial cycles and even one changed speed, grade or duration remain explicit',()=>{
 assert.equal(repeatedWorkoutPattern(workout([up,down,up,down,up])),null);
 for(const change of [{speedKph:4.9},{inclinePercent:19},{durationSeconds:59}])assert.equal(repeatedWorkoutPattern(workout([up,down,up,{...down,...change}])),null);
});
test('unknown conditions never become an assumed repeated protocol',()=>{
 for(const change of [{speedKph:null},{durationSeconds:null},{inclinePercent:undefined}]){
  const row={...up,...change};assert.equal(repeatedWorkoutPattern(workout([row,row,row])),null);
 }
});
test('display handles rower cycles and identical timed segments without claiming completed rounds',()=>{
 const a={kg:null,reps:0,distanceMeters:200,durationSeconds:60},b={kg:null,reps:0,distanceMeters:100,durationSeconds:60};
 assert.equal(repeatedWorkoutPattern({measurementType:'distance_time',loadType:'unknown',sets:[a,b,a,b]}).repeats,2);
 assert.equal(repeatedWorkoutPattern({measurementType:'duration',loadType:'unknown',sets:[{kg:null,reps:0,durationSeconds:60},{kg:null,reps:0,durationSeconds:60}]}).segments.length,1);
 assert.equal(repeatedWorkoutPattern({loadType:'weighted',sets:[{kg:20,reps:10},{kg:20,reps:10}]}),null);
});
