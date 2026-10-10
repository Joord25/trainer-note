import {cardioDistribution,isCardioWorkout} from './generated/cardio-distribution.mjs';
import {measurementType} from './generated/workout-measurements.mjs';
const iso=d=>d.toISOString().slice(0,10);
function day(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T00:00:00Z');return Number.isFinite(+d)&&iso(d)===value?d:null;}
function monday(value){const d=day(value);d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);return iso(d);}
function weightedVolume(rows){
 const sets=rows.filter(r=>!isCardioWorkout(r)&&measurementType(r)==='repetitions'&&['weighted','mixed'].includes(r.loadType)).flatMap(r=>r.sets).filter(s=>Number.isFinite(s.kg)&&s.kg>=0&&Number.isFinite(s.reps)&&s.reps>0);
 return {kgRepetitions:sets.length?Math.round(sets.reduce((total,s)=>total+s.kg*s.reps,0)*100)/100:null,knownLoadSets:sets.length};
}
/** Describe the recorded format and load; do not infer training purpose from repetition count. */
export function repetitionProfile(rows){
 const nonCardio=rows.filter(r=>!isCardioWorkout(r)),repetitionRows=nonCardio.filter(r=>measurementType(r)==='repetitions');
 const profile={totalSets:0,externalLoadSets:0,bodyweightSets:0,unknownLoadSets:0,bands:{low:0,middle:0,high:0,mixed:0,unknown:0},otherSegments:nonCardio.filter(r=>measurementType(r)!=='repetitions').reduce((n,r)=>n+r.sets.length,0),recordIds:nonCardio.map(r=>r.id)};
 const band=reps=>reps<=5?'low':reps<=12?'middle':'high';
 for(const r of repetitionRows)for(const set of r.sets){
  profile.totalSets++;
  if(['weighted','mixed'].includes(r.loadType)&&Number.isFinite(set.kg)&&set.kg>0)profile.externalLoadSets++;
  else if(r.loadType==='bodyweight'||r.loadType==='mixed'&&set.kg===null)profile.bodyweightSets++;
  else profile.unknownLoadSets++;
  const sides=set.leftReps!=null||set.rightReps!=null;
  const reps=(sides?[set.leftReps,set.rightReps]:[set.reps]).filter(v=>Number.isFinite(v)&&v>0);
  const bands=new Set(reps.map(band));
  profile.bands[!reps.length?'unknown':bands.size>1?'mixed':band(reps[0])]++;
 }
 return profile;
}
function summary(rows){
 const cardio=cardioDistribution(rows),strength=rows.filter(r=>!isCardioWorkout(r)&&measurementType(r)==='repetitions');
 const primaryParts=[...new Set(rows.filter(r=>!isCardioWorkout(r)).map(r=>r.bodyPart??'미분류'))].sort().map(part=>{
  const group=rows.filter(r=>!isCardioWorkout(r)&&(r.bodyPart??'미분류')===part);
  return {part,weightedVolume:weightedVolume(group),days:new Set(group.map(r=>r.date)).size,repetitionSets:group.filter(r=>measurementType(r)==='repetitions').reduce((n,r)=>n+r.sets.length,0),otherSegments:group.filter(r=>measurementType(r)!=='repetitions').reduce((n,r)=>n+r.sets.length,0),recordIds:group.map(r=>r.id)};
 });
 const lowRepetitionRecords=strength.flatMap(r=>{
  const indices=r.sets.flatMap((s,index)=>{
   // Unilateral repetitions are assessed per performed side, never by L+R total.
   const unilateral=s.leftReps!=null||s.rightReps!=null;
   const reps=(unilateral?[s.leftReps,s.rightReps]:[s.reps]).filter(v=>Number.isFinite(v)&&v>0);
   return reps.length&&reps.every(v=>v<=5)?[index+1]:[];
  });
  return indices.length?[{recordId:r.id,setNumbers:indices,relativeIntensityKnown:false}]:[];
 });
 return {recordedDays:new Set(rows.map(r=>r.date)).size,repetitionSets:strength.reduce((n,r)=>n+r.sets.length,0),weightedVolume:weightedVolume(strength),primaryParts,
  cardio:{days:cardio.days,segments:cardio.segments,knownSeconds:cardio.seconds,missingTimeSegments:cardio.missingTime,intensityVerified:false,recordIds:cardio.records.map(r=>r.id)},
  repetitionProfile:repetitionProfile(rows),lowRepetitionRecords,recordIds:rows.map(r=>r.id)};
}
/** Observations only. No compliance score, invented intensity, or unlogged-week zeroes. */
export function goalProgramContext(records){
 const valid=records.filter(r=>day(r.date)).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)),to=valid.at(-1)?.date;
 if(!to)return {window:null,completeWeeklyActivityKnown:false,weeks:[],observed:summary([])};
 const start=day(to);start.setUTCDate(start.getUTCDate()-27);const from=iso(start),recent=valid.filter(r=>r.date>=from);
 const weeks=[...new Set(recent.map(r=>monday(r.date)))].map(weekStart=>({weekStart,...summary(recent.filter(r=>monday(r.date)===weekStart))}));
 return {window:{from,to,anchor:'latest-record',days:28},completeWeeklyActivityKnown:false,weeks,observed:summary(recent)};
}
