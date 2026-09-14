import {test} from 'node:test';
import assert from 'node:assert/strict';
import {exerciseLoadContext,LOAD_CONTEXT_PROMPT} from '../load-context.mjs';
import {summarize,REPORT_PROMPT,REPORT_VERSION} from '../domain.mjs';
import {CHAT_PROMPT,CHAT_VERSION} from '../chat.mjs';
const row=(id,date,loadType,kg,reps=12)=>({id,date,exerciseName:'핵 스쿼트',bodyPart:'하체',loadType,sets:[{kg,reps}]});
test('one exercise history retains bodyweight and missing load without false zero volume',()=>{
 const rows=[row('a','2026-09-01','weighted',40),row('b','2026-09-02','bodyweight',null),row('c','2026-09-03','unknown',null),row('d','2026-09-04','weighted',0)];
 const groups=exerciseLoadContext(rows);assert.equal(groups.length,1);assert.equal(groups[0].totalSets,4);assert.equal(groups[0].sessionDays,4);
 assert.deepEqual(groups[0].days.map(d=>d.knownVolume),[480,null,null,0]);assert.deepEqual(groups[0].days.map(d=>d.volumeCoverage),['complete','none','none','complete']);
 assert.deepEqual(summarize(rows).exerciseLoadContext,groups);
});
test('mixed session exposes partial measured volume and load-specific counts',()=>{
 const g=exerciseLoadContext([row('a','2026-09-01','weighted',40),row('b','2026-09-01','bodyweight',null),row('c','2026-09-01','unknown',null)])[0];
 assert.equal(g.sessionDays,1);assert.equal(g.days[0].knownVolume,480);assert.equal(g.days[0].sets,3);assert.equal(g.days[0].reps,36);assert.equal(g.days[0].volumeCoverage,'partial');assert.equal(g.days[0].weightedSets,1);assert.equal(g.days[0].bodyweightSets,1);assert.equal(g.days[0].unknownSets,1);
});
test('different exercise/body part and cardio remain distinct; missing numeric weight stays null',()=>{
 const a=row('a','2026-09-01','weighted',40);assert.equal(exerciseLoadContext([a,{...a,bodyPart:'등'},{...a,exerciseName:'레그 프레스'}]).length,3);
 assert.equal(exerciseLoadContext([{...a,measurementType:'duration'}]).length,0);
 assert.equal(exerciseLoadContext([{...a,sets:[{kg:null,reps:12}]}])[0].days[0].knownVolume,null);
});
test('analysis/next-lesson and assistant share load interpretation contract, with revised caches',()=>{
 assert(REPORT_PROMPT.includes(LOAD_CONTEXT_PROMPT));assert(CHAT_PROMPT.includes(LOAD_CONTEXT_PROMPT));assert.match(REPORT_VERSION,/^trainer-judgment-v\d+-/);assert.match(CHAT_VERSION,/^workout-assistant-v\d+-/);
});
test('spacing aliases share AI evidence and sessions without merging variants or measurements',()=>{
 const a={...row('a','2026-09-01','bodyweight',null,50),exerciseName:'에어 바이크',bodyPart:'전신'};
 const rows=[a,{...a,id:'b',exerciseName:'에어바이크'},{...a,id:'c',date:'2026-09-02',exerciseName:'에어\u00a0바이크'}];
 const s=summarize(rows);assert.equal(s.exerciseIdentities.length,1);assert.equal(s.exerciseIdentities[0].sessionDays,2);assert.deepEqual(s.exerciseIdentities[0].evidenceIds,['a','b','c']);assert.equal(s.exerciseLoadContext[0].totalSets,3);assert.equal(s.exerciseLoadContext[0].sessionDays,2);
 assert.equal(summarize([...rows,{...a,id:'d',exerciseName:'바이크'},{...a,id:'e',measurementType:'duration'}]).exerciseIdentities.length,3);
 assert.equal(rows[0].exerciseName,'에어 바이크');assert.equal(rows[1].exerciseName,'에어바이크');
});
