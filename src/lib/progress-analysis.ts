import {isCardioWorkout} from './cardio-distribution';
import type {WorkoutRecord} from './workout-records';
import {measurementType,exerciseIdentity} from './workout-measurements';
import {progressStats,type SavedTrainingGoal,TRAINING_PARTS} from './training-goals';
export function analysisWindow(records:WorkoutRecord[],period:string){
 const all=progressStats(records),to=all.trend.at(-1)?.date??'';
 const from=to&&period!=='all'?new Date(Date.parse(to+'T12:00:00Z')-(Number(period)-1)*86400000).toISOString().slice(0,10):'';
 return {from,to,...progressStats(records,from,to||'9999-12-31')};
}
export function exerciseKey(r:WorkoutRecord){return exerciseIdentity(r);}
export function exerciseGroups(records:WorkoutRecord[]){
 const map=new Map<string,WorkoutRecord[]>();for(const r of records){const key=exerciseKey(r);map.set(key,[...(map.get(key)??[]),r]);}
 return [...map].map(([key,rows])=>({key,sessionDays:new Set(rows.map(r=>r.date)).size,name:rows[0].exerciseName,part:rows[0].bodyPart,kind:measurementType(rows[0]),load:rows[0].loadType,loadTypes:[...new Set(rows.map(r=>r.loadType))],hasWeighted:rows.some(r=>r.loadType==='weighted'),records:rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id))})).sort((a,b)=>a.name.localeCompare(b.name,'ko'));
}
export type PerformanceMetric='sets'|'volume'|'kg'|'reps'|'left'|'right'|'distance'|'duration'|'incline'|'speed';
export const performanceLabels:Record<PerformanceMetric,[string,string]>={sets:['세트 수','세트'],volume:['볼륨','kg·회'],kg:['최고 중량','kg'],reps:['총 횟수','회'],left:['L 횟수','회'],right:['R 횟수','회'],distance:['총 거리','m'],duration:['총 시간','초'],incline:['평균 경사','%'],speed:['평균 속도','km/h']};
export function performanceDays(records:WorkoutRecord[],metric:PerformanceMetric){
 const map=new Map<string,WorkoutRecord[]>();for(const r of records)map.set(r.date,[...(map.get(r.date)??[]),r]);
 return [...map].sort(([a],[b])=>a.localeCompare(b)).map(([date,rows])=>{
  const sets=rows.flatMap(r=>r.sets),weights=rows.filter(r=>r.loadType==='weighted').flatMap(r=>r.sets).filter(s=>s.kg!==null);
  const sided=sets.filter(s=>s.leftReps!==undefined&&s.rightReps!==undefined);
  let value:number|null=null;
  if(metric==='sets')value=sets.length;
  else if(metric==='volume')value=weights.length?weights.reduce((n,s)=>n+s.kg!*s.reps,0):null;
  else if(metric==='kg')value=weights.length?Math.max(...weights.map(s=>s.kg!)):null;
  else if(metric==='reps')value=sets.reduce((n,s)=>n+s.reps,0);
  else if(metric==='left'||metric==='right')value=sided.length?sided.reduce((n,s)=>n+(metric==='left'?s.leftReps!:s.rightReps!),0):null;
  else if(metric==='incline'||metric==='speed'){const field=metric==='incline'?'inclinePercent':'speedKph',measured=sets.filter(s=>s[field]!=null&&s.durationSeconds!=null&&s.durationSeconds>0),time=measured.reduce((n,s)=>n+s.durationSeconds!,0);value=time?measured.reduce((n,s)=>n+s[field]!*s.durationSeconds!,0)/time:null;}
  else {const field=metric==='distance'?'distanceMeters':'durationSeconds';const measured=sets.filter(s=>s[field]!=null);value=measured.length?measured.reduce((n,s)=>n+s[field]!,0):null;}
  return {date,value,records:rows};
 });
}
export function weekSets(records:WorkoutRecord[]){const map=new Map<string,number>();for(const r of records){if(measurementType(r)!=='repetitions'||isCardioWorkout(r))continue;const date=new Date(r.date+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);const key=date.toISOString().slice(0,10);map.set(key,(map.get(key)??0)+r.sets.length);}return [...map].sort(([a],[b])=>a.localeCompare(b));}
export function allocation(records:WorkoutRecord[],goal:SavedTrainingGoal|null,part:string){
 const stats=progressStats(records),classified=TRAINING_PARTS.reduce((n,p)=>n+(stats.parts[p]??0),0),actual=classified?(stats.parts[part]??0)/classified*100:null;
 if(!goal||goal.startMode==='unknown'||goal.startMode==='date'&&records.some(r=>r.date<goal.startDate))return {actual,target:null,context:'목표 적용 기간·비중 확인 필요'};
 const d=goal.distribution;
 if(d.mode==='percent')return {actual,target:d.shares[part]??0,context:'분류된 부위의 세트 기준'};
 if(d.mode==='focus')return {actual,target:null,context:d.parts.includes(part)?'집중 훈련 부위':'집중 부위 외 훈련'};
 if(d.mode==='split')return {actual,target:null,context:`상체 ${d.upper}% · 하체 ${100-d.upper}% 목표 (코어 제외). 개별 부위 목표는 미설정`};
 return {actual,target:null,context:'부위별 비중 목표 미설정'};
}

/** Hide a legacy generated explanation without changing stored trainer notes. */
export function displayWorkoutNotes(notes:string){
 return notes.split(/\n|(?<=[.!?])\s+/).filter(line=>!/^kg란에\s*[x×]\s*표기되어\s*있어\s*맨몸으로\s*간주함[.!?]?$/i.test(line.trim())).join('\n').trim();
}

/** Only supplied notes; this does not infer why training load changed. */
export function sessionChartContext(records:WorkoutRecord[],date:string,sessionNote?:{text:string}){
 const rows=records.filter(r=>r.date===date),notes=new Map<string,{text:string;label:string}>(),sources=new Map<string,{id:string;label:string}>();
 if(sessionNote?.text.trim())notes.set(sessionNote.text.trim().replace(/\s+/g,' '),{text:sessionNote.text.trim(),label:'수업 메모'});
 for(const r of rows){
  const explicit=r.trainerNote?.trim();
  // Legacy notes mixed observations with OCR explanations. Surface only observation-like text.
  const legacy=r.trainerNote===undefined?(r.notes??'').split(/\n|(?<=[.!?])\s+/).filter(t=>/컨디션|통증|피로|수면|불편|아프|회복|어지|부상|휴식|세트.*(축소|감소|줄)|강도.*조절/.test(t)&&!/(판독|간주|원문 해석|단위 확인)/.test(t)).join('\n').trim():'';
  const text=explicit||legacy;if(text){const key=text.replace(/\s+/g,' ').trim();if(!notes.has(key))notes.set(key,{text,label:explicit?`운동 메모 · ${r.exerciseName}`:'기록 메모'});}
  if(r.sourceHash){const key=`${r.sourceHash}:${r.sourcePage}`;if(!sources.has(key))sources.set(key,{id:r.id,label:`${r.sourceName} · ${r.sourcePage}쪽`});}
 }
 return {notes:[...notes.values()],sources:[...sources.values()]};
}
