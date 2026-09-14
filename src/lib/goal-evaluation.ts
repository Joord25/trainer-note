import type {WorkoutRecord} from './workout-records';
import {applicableRange,progressStats,type SavedTrainingGoal} from './training-goals';
import {displayWorkoutNotes,exerciseGroups,performanceDays,type PerformanceMetric} from './progress-analysis';
const fmt=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:1});
export function goalEvaluationData(records:WorkoutRecord[],allRecords:WorkoutRecord[],goal:SavedTrainingGoal){
 const afterGoal=(rows:WorkoutRecord[])=>goal.startMode==='unknown'?[]:rows.filter(r=>goal.startMode!=='date'||r.date>=goal.startDate);
 const stats=progressStats(afterGoal(records)),total=progressStats(afterGoal(allRecords)),groups=exerciseGroups(stats.records);
 const plans=(['sets','volume'] as const).flatMap(metric=>{
  const days=stats.trend.flatMap(d=>{const range=applicableRange(goal,d.date,metric),value=metric==='sets'?(d.sets||null):d.volume;
   if(!range||value===null||metric==='volume'&&d.excludedVolume>0)return [];
   return [{date:d.date,value,inRange:value>=range.min&&value<=range.max}];
  });
  return goal.plan[metric]?[{metric,range:goal.plan[metric]!,days,within:days.filter(d=>d.inRange).length}]:[];
 });
 const measures=goal.metrics.map(id=>{
  const candidates=groups.filter(g=>id==='strength'?g.kind==='repetitions':id==='cardio'?g.kind!=='repetitions':id==='side'?g.records.some(r=>r.sets.some(s=>s.leftReps!==undefined)):false);
  const samples=candidates.map(g=>{
   const metric:PerformanceMetric=id==='side'?'left':id==='cardio'?(g.kind==='duration'||g.kind==='incline_speed_time')?'duration':'distance':g.hasWeighted?'kg':'reps';
   const days=performanceDays(g.records,metric).filter(d=>d.value!==null),first=days[0],last=days.at(-1);
   const unit=id==='side'?'회':id==='cardio'?metric==='duration'?'초':'m':metric==='kg'?'kg':'회';
   const describe=(point:typeof first|undefined)=>{if(!point)return '—';if(id==='side'){const right=performanceDays(g.records,'right').find(d=>d.date===point.date)?.value;return `L ${fmt(point.value!)} / R ${right===null||right===undefined?'—':fmt(right)}회`;}return `${fmt(point.value!)} ${unit}`;};
   const extra=(point:typeof first|undefined)=>{
    if(!point)return '';
    if(id==='cardio'&&g.kind==='incline_speed_time'){const sets=g.records.filter(r=>r.date===point.date).flatMap(r=>r.sets);return [...new Set(sets.map(s=>`경사 ${fmt(s.inclinePercent!)}% · ${fmt(s.speedKph!)}km/h`))].join(' / ');}
    if(id==='cardio'&&g.kind==='distance_time'){const time=performanceDays(g.records,'duration').find(d=>d.date===point.date)?.value;return time===null||time===undefined?'시간 미기록':`${fmt(time)}초`;}
    if(id==='strength'&&metric==='kg'){const sets=g.records.filter(r=>r.date===point.date&&r.loadType==='weighted').flatMap(r=>r.sets).filter(s=>s.kg===point.value);const best=sets.reduce<(typeof sets)[number]|null>((best,s)=>!best||s.reps>best.reps?s:best,null);return best?`${best.leftReps!==undefined?`L ${best.leftReps} / R ${best.rightReps}회`:`${best.reps}회`} · 최고 중량 세트`:'';}
    return '';
   };
   return {firstExtra:extra(first),latestExtra:days.length>1?extra(last):'',key:g.key,name:g.name,metric,first:describe(first),latest:days.length>1?describe(last):'비교 대기',firstDate:first?.date??'',latestDate:days.length>1?last?.date??'':'',measuredDays:days.length,records:g.records,mixed:g.loadTypes.length>1};
  }).sort((a,b)=>b.measuredDays-a.measuredDays||a.name.localeCompare(b.name,'ko'));
  const notes=stats.records.filter(r=>displayWorkoutNotes(r.notes));
  const available=id==='observation'?notes.length>0:samples.some(s=>s.measuredDays>=2);
  return {id,samples,notes,available,status:id==='composition'?'측정 대기':id==='observation'?notes.length?'관찰 검토':'관찰 대기':available?'기록 비교 가능':samples.length?'추가 기록 필요':'측정 대기'};
 });
 return {stats,total,plans,measures,remaining:Math.max(0,goal.reviewAfter-total.days),due:total.days>=goal.reviewAfter};
}
