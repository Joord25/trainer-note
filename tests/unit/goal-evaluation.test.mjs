import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),dir=mkdtempSync(join(tmpdir(),'goal-evaluation-test-'));
try{
 for(const name of ['cardio-distribution','goal-coaching','assessment-results','training-assessment','workout-measurements','training-goals','progress-analysis','goal-evaluation'])writeFileSync(join(dir,name+'.mjs'),ts.transpileModule(readFileSync(new URL('src/lib/'+name+'.ts',root),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '\.\/(cardio-distribution|goal-coaching|assessment-results|training-assessment|training-goals|workout-measurements|progress-analysis)'/g,"from './$1.mjs'"));
 const {goalEvaluationData}=await import(pathToFileURL(join(dir,'goal-evaluation.mjs'))),{blankTrainingGoal}=await import(pathToFileURL(join(dir,'training-goals.mjs')));
 const goal={...blankTrainingGoal(),revision:1,primary:'근비대',startDate:'2026-09-01',reviewAfter:4,metrics:['strength','composition','observation'],plan:{sets:{min:1,max:2},volume:{min:100,max:500},from:'2026-09-01',to:'2026-09-30',reason:'트레이너 계획',confirmed:true}};
 const row=(id,date)=>({id,date,exerciseName:'핵 스쿼트',bodyPart:'하체',loadType:'weighted',sets:[{kg:20,reps:12}],status:'confirmed',notes:'',pending:false});
 const rows=[row('a','2026-09-01'),row('b','2026-09-05'),row('c','2026-09-10'),row('d','2026-09-12')];
 const scoped=goalEvaluationData(rows.slice(2),rows,goal);assert.equal(scoped.stats.days,2);assert.equal(scoped.total.days,4);assert.equal(scoped.due,true);assert.equal(scoped.remaining,0);
 assert.equal(scoped.measures.find(m=>m.id==='composition').status,'측정 대기');assert.equal(scoped.measures.find(m=>m.id==='composition').available,false);
 const one=goalEvaluationData(rows.slice(0,1),rows.slice(0,1),goal);assert.equal(one.measures[0].available,false);assert.equal(one.measures[0].samples[0].latest,'비교 대기');assert.equal(one.remaining,3);
 const mixed=[row('a','2026-09-01'),{...row('b','2026-09-01'),loadType:'bodyweight',sets:[{kg:null,reps:12}]}];
 const result=goalEvaluationData(mixed,mixed,goal);assert.equal(result.plans.find(p=>p.metric==='sets').days.length,1);assert.equal(result.plans.find(p=>p.metric==='volume').days.length,0);assert.equal(result.total.days,1);
 const unknown=goalEvaluationData(rows,rows,{...goal,startMode:'unknown'});assert.equal(unknown.total.days,0);assert.equal(unknown.measures[0].samples.length,0);
 const invalid=goalEvaluationData([{...rows[0],pending:true},{...rows[1],sets:[{kg:20,reps:0}]}],[],goal);assert.equal(invalid.stats.days,0);
 console.log('Passed: full-goal review count independent of period, missing composition, single date, mixed-volume exclusion, same-day grouping, unknown start, invalid records.');
}finally{rmSync(dir,{recursive:true});}
