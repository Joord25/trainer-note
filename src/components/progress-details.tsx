"use client";
import {useState} from 'react';
import {cardioDistribution,isCardioWorkout} from '../lib/cardio-distribution';
import type {WorkoutRecord} from '../lib/workout-records';
import {formatWorkoutSet,measurementType} from '../lib/workout-measurements';
import {trainingGoalTitle,TRAINING_PARTS,progressStats,type SavedTrainingGoal} from '../lib/training-goals';
import {allocation,exerciseGroups,exerciseFamilies,performanceMetrics,performanceChartDays,companionMetric,performanceLabels,weekSets,type PerformanceMetric} from '../lib/progress-analysis';
import {WorkoutSelect} from './workout-select';
import {BodyMap} from './body-map';
import {bodyStats} from './member-analysis';
import {ChartRecordHover} from './chart-record-hover';
const fmt=(n:number|null)=>n===null?'—':n.toLocaleString('ko-KR',{maximumFractionDigits:1});
type Props={records:WorkoutRecord[];goal:SavedTrainingGoal|null;onGoal:()=>void;onEvidence:(id:string)=>void;onTrend:(key:string,metric?:PerformanceMetric)=>void};
import {RecordLines} from './workout-record-lines';

export function BodyDistribution({records,goal,onEvidence,onTrend,part,onPart}:{part:string;onPart:(part:string)=>void;records:WorkoutRecord[];goal:SavedTrainingGoal|null;onEvidence:(id:string)=>void;onTrend:(key:string,metric?:PerformanceMetric)=>void}){
 const cardio=cardioDistribution(records),strength=records.filter(r=>measurementType(r)==='repetitions'&&!isCardioWorkout(r)),chosen=part||TRAINING_PARTS.find(p=>strength.some(r=>r.bodyPart===p))||'하체';
 const selected=strength.filter(r=>r.bodyPart===chosen),stats=progressStats(selected),share=allocation(strength,goal,chosen),weeks=weekSets(selected),groups=exerciseGroups(selected),max=Math.max(1,...weeks.map(([,n])=>n));
 if(chosen==='유산소')return <div className="pa-details"><BodyMap stats={bodyStats(strength)} cardio={cardio} sourceLabel="선택 기간의 운동 기록" hideDetails onPartSelect={onPart} selectedPart={chosen} onSource={()=>{}}/><section className="pa-section"><div className="pa-heading"><h3>유산소</h3><span>근육별 세트 비중과 별도 집계</span></div><div className="pa-kpis"><div><span>기록된 시간</span><strong>{fmt(cardio.seconds===null?null:cardio.seconds/60)}<small>분</small></strong></div><div><span>수행 구간</span><strong>{cardio.segments}<small>구간</small></strong></div><div><span>훈련한 수업일</span><strong>{cardio.days}<small>일</small></strong></div></div>{!!cardio.missingTime&&<p className="record-help">시간 미기록 {cardio.missingTime}구간 · 시간 합계에서 제외</p>}<p className="record-help">운동·회복 구간 중 기록된 시간 합계. 구간 수는 완료 라운드 수와 다름.</p></section><section className="pa-section"><h3>운동별 구성</h3>{exerciseGroups(cardio.records).map(g=><details className="pa-exercise" key={g.key}><summary><span><strong>{g.name}</strong><small>{g.records.reduce((n,r)=>n+r.sets.length,0)}구간 · {g.sessionDays}일</small></span></summary><button className="pa-link" onClick={()=>onTrend(g.key,g.kind==='repetitions'?'reps':g.kind==='distance'?'distance':'duration')}>이 운동의 변화 보기 →</button><RecordLines records={g.records} onEvidence={onEvidence}/></details>)}{!cardio.records.length&&<p className="record-help">선택 기간에 유산소 기록이 없어요.</p>}</section></div>;
 return <div className="pa-details"><BodyMap cardio={cardio} stats={bodyStats(strength)} sourceLabel="선택 기간 · 중량·횟수 기록" hideDetails onPartSelect={onPart} selectedPart={chosen} onSource={()=>{}}/>
 <section className="pa-section"><div className="pa-heading"><h3>{chosen}</h3><span>{share.context}</span></div><div className="pa-kpis"><div><span>목표 / 실제 비중</span><strong>{fmt(share.target)} / {fmt(share.actual)}<small>%</small></strong></div><div><span>총 세트</span><strong>{stats.sets}<small>세트</small></strong></div><div><span>훈련한 수업일</span><strong>{stats.days}<small>일</small></strong></div></div>
 {share.target!==null&&share.actual!==null&&<p className="pa-comment">목표 대비 {Math.abs(share.actual-share.target)<.1?'같은 비중이에요.':`${fmt(Math.abs(share.actual-share.target))}%p ${share.actual>share.target?'높아요':'낮아요'}.`} 회원의 반응과 의도한 조정을 함께 확인해주세요.</p>}
 <h4 title="월요일 시작 · 기간 양끝 주는 일부 날짜만 포함">주별 세트 배분</h4>{weeks.length?<div className="pa-weeks">{weeks.map(([date,n])=><div key={date}><span>{date.slice(5)} 주</span><div><i style={{width:n/max*100+'%'}}/></div><strong>{n}세트</strong></div>)}</div>:<p className="record-help">선택 기간에 이 부위의 중량·횟수 기록이 없어요.</p>}
 </section><section className="pa-section"><h3>운동별 구성</h3>{groups.map(g=><details className="pa-exercise" key={g.key}><summary><span><strong>{g.name}</strong><small>{g.records.reduce((n,r)=>n+r.sets.length,0)}세트 · {g.sessionDays}일</small></span><span>{formatWorkoutSet(g.records.at(-1)!,g.records.at(-1)!.sets.at(-1)!)}<small>최근 기록의 마지막 세트</small></span></summary><button className="pa-link" onClick={()=>onTrend(g.key)}>이 운동의 변화 보기 →</button><RecordLines records={g.records} onEvidence={onEvidence}/></details>)}</section></div>;
}
export function PerformanceTrend({records,selection,onSelect,onEvidence,goal,requested,onMetric}:{requested:PerformanceMetric;onMetric:(metric:PerformanceMetric)=>void;records:WorkoutRecord[];selection:string;onSelect:(key:string)=>void;onEvidence:(id:string)=>void;goal:SavedTrainingGoal|null}){
 const [comparison,setComparison]=useState<{key:string;primary:PerformanceMetric;metric:PerformanceMetric|null}|null>(null);
 const groups=exerciseFamilies(records),group=groups.find(g=>g.key===selection||g.variants.some(v=>v.key===selection))??groups[0];
 if(!group)return <p className="file-empty">선택 기간에 비교할 운동 기록이 없어요.</p>;
 const options=performanceMetrics(group.records),metric=options.includes(requested)?requested:options[0];
 const companion=comparison?.key===group.key&&comparison.primary===metric&&(comparison.metric===null||options.includes(comparison.metric))?comparison.metric:companionMetric(options,metric);
 function toggleMetric(next:PerformanceMetric){
  if(next===metric){
   if(!companion)return;
   setComparison({key:group!.key,primary:companion,metric:null});onMetric(companion);
  }else{
   setComparison({key:group!.key,primary:metric,metric:next===companion?null:next});
  }
 }
 const measured=[metric,...(companion?[companion]:[])].map(m=>({metric:m,days:performanceChartDays(group.records,m)}));
 const series=measured.map(({metric:m,days},index)=>{
  const values=measured.filter(s=>performanceLabels[s.metric][1]===performanceLabels[m][1]).flatMap(s=>s.days.map(d=>d.plotValue));
  const min=Math.min(0,...values)*1.15,max=Math.max(1,...values)*1.15;
  const y=(v:number)=>220-(v-min)/(max-min)*175;
  return {metric:m,days,min,max,y,color:index===1?'#a96a32':'#355d43',dashed:index===1,index};
 });
 const primary=series[0],days=primary.days,x=(i:number)=>60+(days.length>1?i/(days.length-1):.5)*560;
 const pathFor=(s:typeof primary)=>s.days.map((d,i)=>`${i===0?'M':'L'}${x(i)} ${s.y(d.plotValue)}`).join(' ');
 const goalIndex=goal?.startMode==='date'?days.findIndex(d=>d.date>=goal.startDate):-1;
 const first=days.find(d=>d.value!==null),last=days.findLast(d=>d.value!==null),delta=first&&last&&first!==last?last.value!-first.value!:null;
 return <div className="pa-details pa-performance"><div className="pa-select-label"><span>비교할 운동</span><WorkoutSelect label="비교할 운동" value={group.key} onChange={onSelect} options={groups.map(g=>({value:g.key,label:`${g.name} · ${g.part} (${g.sessionDays}개 기록일)`}))}/></div><div className="pa-part-picker performance-metric-tabs" role="group" aria-label="그래프 지표, 최대 2개 선택">{options.map(m=>{const selected=m===metric||m===companion;return <button key={m} aria-pressed={selected} onClick={()=>toggleMetric(m)}><i aria-hidden="true" style={{visibility:selected?'visible':'hidden',borderColor:m===companion?'#a96a32':'#355d43',borderTopStyle:m===companion?'dashed':'solid'}}/>{performanceLabels[m][0]}</button>;})}</div>

 <div className="pa-kpis"><div><span>첫 기록 · {first?.date??'—'}</span><strong>{fmt(first?.value??null)}<small>{performanceLabels[metric][1]}</small></strong></div><div><span>최근 · {last?.date??'—'}</span><strong>{fmt(last?.value??null)}<small>{performanceLabels[metric][1]}</small></strong></div><div><span>기록 차이</span><strong>{delta!==null&&delta>0?'+':''}{fmt(delta)}<small>{performanceLabels[metric][1]}</small></strong></div></div>
 <ChartRecordHover metric="volume" valueLabel={series.map(s=>performanceLabels[s.metric][0]).join(' · ')} valueUnit={performanceLabels[metric][1]} points={days.map((d,i)=>({date:d.date,sets:0,volume:d.value,x:x(i)/680*100,y:primary.y(d.plotValue)/266*100,values:series.map(s=>({label:performanceLabels[s.metric][0],unit:performanceLabels[s.metric][1],value:s.days[i].value,missingAtZero:true}))}))}><svg className="pa-chart" viewBox="0 0 680 266" role="img" aria-label={`${group.name} ${series.map(s=>performanceLabels[s.metric][0]).join(' 및 ')} 변화${companion?' · 왼쪽 '+performanceLabels[metric][1]+' · 오른쪽 '+performanceLabels[companion][1]:''}`}>
 {[0,.5,1].map(v=><line key={v} x1="55" x2="635" y1={primary.y(primary.min+v*(primary.max-primary.min))} y2={primary.y(primary.min+v*(primary.max-primary.min))} stroke="#e2e8de"/>)}
 {series.map(s=><g key={s.metric}><text x={s.index===0?45:645} y="23" textAnchor={s.index===0?'end':'start'} fill={s.color} fontSize="12">{performanceLabels[s.metric][1]}</text>{[0,.5,1].map(v=><text key={v} x={s.index===0?45:645} y={s.y(s.min+v*(s.max-s.min))+4} textAnchor={s.index===0?'end':'start'} fill={s.color} fontSize="11">{fmt(s.min+v*(s.max-s.min))}</text>)}<path d={pathFor(s)} stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dashed?'6 4':undefined} fill="none"/>{s.days.map((d,i)=><circle key={d.date} cx={x(i)} cy={s.y(d.plotValue)} r={s.dashed?5:4} strokeDasharray={d.missing?'2 2':undefined} data-missing={d.missing||undefined} stroke={s.color} fill="var(--surface, white)" strokeWidth="2"/>)}</g>)}
 {goalIndex>0&&<g><line x1={(x(goalIndex-1)+x(goalIndex))/2} x2={(x(goalIndex-1)+x(goalIndex))/2} y1="25" y2="220" stroke="#a2b494" strokeDasharray="4 4"/><text x={(x(goalIndex-1)+x(goalIndex))/2} y="18" textAnchor="middle" fontSize="11" fill="#708074">목표 적용</text></g>}</svg></ChartRecordHover>
 {companion&&<div className="performance-series-legend">{series.map(s=><span key={s.metric}><i style={{borderColor:s.color,borderTopStyle:s.dashed?'dashed':'solid'}}/>{performanceLabels[s.metric][0]} · {s.index===0?'왼쪽':'오른쪽'} {performanceLabels[s.metric][1]}</span>)}</div>}
 <p className="record-help">미기록은 그래프에서 0으로 표시하고, 기록 차이 계산에서는 제외해요.</p>
 <details className="analysis-calculation-details"><summary>비교 조건</summary><p className="record-help">{days.length<2?'비교할 다른 날짜의 기록이 필요해요. ':''}같은 운동명과 부위의 기록을 날짜별로 함께 보여줘요. 띄어쓰기 차이는 구분하지 않아요. 거리·시간은 기록된 값의 합계, 중량은 날짜별 최고 중량이에요. 볼륨은 중량·횟수가 기록된 세트만 집계해요. 미기록은 그래프에서만 0으로 표시하며 원본 기록과 통계는 바꾸지 않아요. 점에 마우스를 올리거나 날짜를 누르면 실제 0과 미기록을 구분할 수 있어요. 기구·자세·가동 범위는 원본과 메모를 함께 확인해주세요. {metric==='left'||metric==='right'?'좌우가 기록된 세트의 횟수만 합산해요.':''}{group.variants.some(g=>g.kind==='incline_speed_time')?'경사·속도는 구간 시간으로 가중 평균해요.':''}</p></details>
 {goal?.startMode==='date'&&days.some(d=>d.date>=goal.startDate)&&days.some(d=>d.date<goal.startDate)&&<p className="pa-comment">{goal.startDate} 목표 적용 시작 · {trainingGoalTitle(goal)}</p>}
 <section className="pa-section"><h3>수업별 수행</h3><RecordLines records={group.records} onEvidence={onEvidence}/></section></div>;
}

export {GoalEvaluation} from './goal-evaluation';
