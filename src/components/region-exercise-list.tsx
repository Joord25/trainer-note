'use client';
import {exerciseGroups,type PerformanceMetric} from '../lib/progress-analysis';
import type {WorkoutRecord} from '../lib/workout-records';
import type {ChangeRegion} from './change-evidence-card';
export function RegionExerciseList({region,records,onSelect}:{region:ChangeRegion;records:WorkoutRecord[];onSelect:(key:string,metric:PerformanceMetric)=>void}){
 const parts=region==='상체'?['등','가슴','어깨','이두','삼두','팔']: [region];
 const groups=exerciseGroups(records.filter(r=>parts.includes(r.bodyPart))).sort((a,b)=>b.sessionDays-a.sessionDays||a.name.localeCompare(b.name));
 return <section className="region-exercise-list" aria-label={`${region} 운동 목록`}><h3>{region} 운동</h3><p>운동을 선택하면 변화 그래프로 바로 연결됩니다.</p>{groups.length?<ul>{groups.map(g=><li key={g.key}><button onClick={()=>onSelect(g.key,g.kind==='repetitions'?(g.hasWeighted?'volume':'reps'):g.kind==='distance'?'distance':'duration')}><span><strong>{g.name}</strong><small>{g.part} · {g.sessionDays}개 기록일</small></span><span aria-hidden="true">↗</span></button></li>)}</ul>:<p>선택한 기간에 해당 부위의 운동 기록이 없습니다.</p>}</section>;
}
