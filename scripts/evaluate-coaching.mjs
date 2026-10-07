// node scripts/evaluate-coaching.mjs [--live]
// Synthetic, de-identified benchmark. --live makes exactly two billed Gemini calls.
// Supply TRAINER_NOTE_GEMINI_API_KEY through the environment; no key is printed.
import assert from 'node:assert/strict';
import {compactCoachingFacts,COACHING_INPUT_TOKENS} from '../functions/coaching-input.mjs';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {changeEvidence,CHANGE_PROMPT,changeSchema,validateChanges,CYCLE_PROMPT,cycleSchema,validateCycle,cycleOptions,WORKFLOW_VERSION} from '../functions/coaching-workflow.mjs';
import {createGemini} from '../functions/gemini.mjs';
import {openApiSchema,MODEL} from '../functions/domain.mjs';
import {withTrainingGuidance} from '../functions/training-guidance.mjs';
const row=(id,date,exerciseName,kg,reps,bodyPart)=>({id,date,exerciseName,bodyPart,measurementType:'repetitions',loadType:'weighted',sets:reps.map(reps=>({kg,reps}))});
const records=[row('s1','2026-06-20','고블릿 스쿼트',12,[10,10,10],'하체'),row('s2','2026-09-02','고블릿 스쿼트',6,[10,10,12],'하체'),row('s3','2026-10-03','고블릿 스쿼트',8,[12,12,12],'하체'),row('r1','2026-06-30','시티드 로우',14.5,[15,15],'등'),row('r2','2026-09-30','시티드 로우',14.5,[12,12,12],'등')],evidence=changeEvidence(records);
assert.equal(evidence.find(e=>e.name==='고블릿 스쿼트'&&e.metric==='volume').overall.percent,-20);
assert.equal(evidence.find(e=>e.name==='고블릿 스쿼트'&&e.metric==='volume').recent.percent,50);
assert.equal(evidence.find(e=>e.name==='시티드 로우'&&e.metric==='volume').overall.percent,20);
console.log('Deterministic benchmark passed: squat overall -20%, recent +50%; row volume +20%.');
if(!process.argv.includes('--live')){console.log('No model called. Run --live with a configured key to inspect actual model wording and plans.');process.exit(0);}
const key=process.env.TRAINER_NOTE_GEMINI_API_KEY||process.env.GEMINI_API_KEY;if(!key)throw Error('Gemini key unavailable. No model called.');
const model=createGemini({apiKey:()=>key}),output=await mkdtemp(join(tmpdir(),'trainer-coaching-eval-'));
const result=await model(withTrainingGuidance('member-changes',{system:CHANGE_PROMPT,schema:openApiSchema(changeSchema(evidence)),parts:[{text:JSON.stringify(compactCoachingFacts({records,evidence,goal:{primary:'근력'},memberNotes:'초기 운동 경험 적음',sessionNotes:[]}))}],maxInputTokens:COACHING_INPUT_TOKENS,maxOutputTokens:6000}));
await writeFile(join(output,'analysis-raw.json'),JSON.stringify(result,null,2),{mode:0o600});
const report=validateChanges(result.value,evidence),options=cycleOptions({count:4,frequency:2,minutes:50,equipment:'기록에 있는 기구만',directions:report.directions.map(d=>({id:d.id,text:d.text}))});
const candidates=[records[2],records[4]].map(r=>({id:r.id,exerciseName:r.exerciseName,bodyPart:r.bodyPart,loadType:r.loadType,measurementType:r.measurementType,referenceDate:r.date,referenceSegments:r.sets}));
const proposed=await model(withTrainingGuidance('cycle-plan',{system:CYCLE_PROMPT,schema:openApiSchema(cycleSchema(candidates)),parts:[{text:JSON.stringify(compactCoachingFacts({records,evidence,analysis:report,options,candidates}))}],maxInputTokens:COACHING_INPUT_TOKENS,maxOutputTokens:16000}));
await writeFile(join(output,'plan-raw.json'),JSON.stringify(proposed,null,2),{mode:0o600});
const plan=validateCycle(proposed.value,candidates,options);
await writeFile(join(output,'review.json'),JSON.stringify({model:MODEL,version:WORKFLOW_VERSION,report,plan,semanticQuality:'Human review required; schema acceptance is not a quality score.',checklist:['Does the answer distinguish full-period decline from recent recovery?','Does row volume growth remain visible without claiming muscle growth?','Are proposed doses clearly separate from recorded doses?','Are progression and adjustment conditional?']},null,2),{mode:0o600});
console.log('Actual responses saved for review:',output);
