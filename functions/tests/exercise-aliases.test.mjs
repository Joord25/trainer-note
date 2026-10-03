import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aliasCorrection,applyExerciseAliases} from '../exercise-aliases.mjs';
test('name changes learn raw labels while dose-only edits do not',()=>{
 assert.deepEqual(aliasCorrection({rawName:'SLR',exerciseName:''},{exerciseName:'사이드 레터럴 레이즈'}),{alias:'SLR',exerciseName:'사이드 레터럴 레이즈'});
 assert.equal(aliasCorrection({rawName:'WL',exerciseName:'워킹 런지'},{exerciseName:'워킹 런지',sets:[]}),null);
});
test('exact aliases normalize case and dots but never replace compound or substring labels or measurements',()=>{
 const original={records:[{rawName:'s.l.r.',exerciseName:'',sets:[],issues:['횟수 확인']},{rawName:'SLR + WL',exerciseName:'복합',sets:[],components:[{rawName:'WL',exerciseName:'',sets:[{kg:10,reps:12}]}]}]};
 const result=applyExerciseAliases(original,[{alias:'SLR',exerciseName:'사이드 레터럴 레이즈',nameAlias:true},{alias:'WL',exerciseName:'워킹 런지',nameAlias:true}]);
 assert.equal(result.records[0].exerciseName,'사이드 레터럴 레이즈');assert.deepEqual(result.records[0].sets,[]);assert.deepEqual(result.records[0].issues,['횟수 확인']);
 assert.equal(result.records[1].exerciseName,'복합');assert.equal(result.records[1].components[0].exerciseName,'워킹 런지');assert.equal(original.records[0].exerciseName,'');
 assert.deepEqual(applyExerciseAliases(original,[]),original);
});
