"use client";
import {exerciseFamilies,performanceMetrics,type PerformanceMetric} from '../lib/progress-analysis';
import type {WorkoutRecord} from '../lib/workout-records';
import type {ChangeRegion} from './change-evidence-card';
export function RegionExerciseList({region,records,onSelect}:{region:ChangeRegion;records:WorkoutRecord[];onSelect:(key:string,metric:PerformanceMetric)=>void}){
 const parts=region==='상체'?['등','가슴','어깨','이두','삼두','팔']:[region];
 const families=exerciseFamilies(records.filter(r=>parts.includes(r.bodyPart)));
 return <section className="region-exercise-list" aria-label={`${region} 운동 목록`}><h3>{region} 운동</h3><p>운동을 선택하면 변화 그래프로 연결돼요.</p>{families.length?<ul>{families.map(f=><li key={f.key}><button onClick={()=>onSelect(f.key,performanceMetrics(f.records)[0])}><span><strong>{f.name}</strong><small>{f.part} · {f.sessionDays}개 기록일</small></span><span aria-hidden="true">↗</span></button></li>)}</ul>:<p>선택한 기간에 해당 부위의 운동 기록이 없어요.</p>}</section>;
}
