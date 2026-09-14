"use client";
import type {SessionNote} from '../lib/session-notes';
import {useMemo,useState} from 'react';
import {sessionChartContext} from '../lib/progress-analysis';
import {ChartRecordHover} from './chart-record-hover';
import {BodyMap} from './body-map';
import {cardioDistribution} from '../lib/cardio-distribution';
import {bodyStats} from './member-analysis';
import {Icon} from './icons';
import {WorkoutSelect} from './workout-select';
import type {WorkoutRecord} from '../lib/workout-records';
import {trainingGoalTitle,progressStats,applicableRange,observedRange,TRAINING_PARTS,type SavedTrainingGoal,type ProgressDay} from '../lib/training-goals';
const format=(v:number|null)=>v===null?'—':v.toLocaleString('ko-KR',{maximumFractionDigits:1});
export function ProgressSummary({sessionNotes=[],records,goal,onGoal,onEvidence,onBody,onOriginalRecord}:{sessionNotes?:SessionNote[];onOriginalRecord?:(id:string)=>void;onBody?:(part?:string)=>void;records:WorkoutRecord[];goal:SavedTrainingGoal|null;onGoal:()=>void;onEvidence:(id:string)=>void}){
 const [metric,setMetric]=useState<'sets'|'volume'>('volume'),[band,setBand]=useState<'plan'|'observed'>('plan'),[selected,setSelected]=useState('');
 const stats=useMemo(()=>progressStats(records),[records]),last=stats.trend.at(-1)?.date??'';
 const days=stats.trend,value=(d:ProgressDay)=>metric==='sets'?(d.sets||null):d.volume,observation=observedRange(days.flatMap(d=>value(d)===null?[]:[value(d)!])),planned=days.map(d=>applicableRange(goal,d.date,metric)),hasPlan=planned.some(Boolean),unit=metric==='sets'?'세트':'kg·회';
 const selectedDay=days.find(d=>d.date===selected)??days.at(-1),selectedRange=selectedDay?applicableRange(goal,selectedDay.date,metric):null,selectedValue=selectedDay?value(selectedDay):null;
 const status=selectedValue===null?'기록 없음':!selectedRange?'계획 기준 없음':selectedValue<selectedRange.min?'계획보다 낮음':selectedValue>selectedRange.max?'계획보다 높음':'계획 범위 안';
 const max=Math.max(1,...days.flatMap(d=>value(d)===null?[]:[value(d)!]),...(band==='plan'?planned.flatMap(r=>r?[r.max]:[]):observation?[observation.max]:[]))*1.15;
 const x=(i:number)=>60+(days.length>1?i/(days.length-1):.5)*560,y=(v:number)=>220-v/max*175;
 const paths:string[]=[];let current='';days.forEach((d,i)=>{const v=value(d);if(v===null){if(current)paths.push(current);current='';}else current+=(current?' L ':'M ')+x(i)+' '+y(v);});if(current)paths.push(current);
 const range=band==='plan'?selectedRange:observation;
 const sourceStats=bodyStats(stats.records.filter(r=>(r.measurementType??'repetitions')==='repetitions'));
 const checks=days.flatMap(d=>(['sets','volume'] as const).flatMap(m=>{const r=applicableRange(goal,d.date,m),v=m==='sets'?(d.sets||null):d.volume;return r&&v!==null?[{date:d.date,inRange:v>=r.min&&v<=r.max}]:[];}));
 const judged=checks.length>0,checkedDays=new Set(checks.map(c=>c.date)).size,outsideDays=new Set(checks.filter(c=>!c.inRange).map(c=>c.date)).size;
 const headline=outsideDays?`비교한 ${checkedDays}일 중 ${outsideDays}일 범위 이탈`:`비교한 ${checkedDays}일 모두 계획 범위 내`;
 let distributionComment='';
 if(goal){const d=goal.distribution,classified=TRAINING_PARTS.reduce((n,p)=>n+(stats.parts[p]??0),0),upper=TRAINING_PARTS.filter(p=>p!=='하체'&&p!=='코어').reduce((n,p)=>n+(stats.parts[p]??0),0),lower=stats.parts['하체']??0;
 if(goal.startMode==='unknown')distributionComment='목표 적용일 미설정';
 else if(goal.startMode==='date'&&days.some(d=>d.date<goal.startDate))distributionComment='목표 적용 전 기록 포함';
 else if(d.mode==='split'&&upper+lower>0)distributionComment=`상체 목표 ${d.upper}% / 기록 ${format(upper/(upper+lower)*100)}% · 하체 목표 ${100-d.upper}% / 기록 ${format(lower/(upper+lower)*100)}%.`;
 else if(d.mode==='percent'&&classified>0)distributionComment=d.parts.map(p=>`${p} 목표 ${d.shares[p]}% / 기록 ${format((stats.parts[p]??0)/classified*100)}%`).join(' · ');
 else if(d.mode==='focus')distributionComment=`집중 부위 ${d.parts.join('·')}에 ${d.parts.reduce((n,p)=>n+(stats.parts[p]??0),0)}세트 · 집중 부위`;}
 return <div className="progress-summary">
 {goal&&<div className="ps-goal"><span>{trainingGoalTitle(goal)}{goal.secondary.length?' · '+goal.secondary.join(' · '):''}</span><button onClick={onGoal}>목표·기준 수정</button></div>}
 {!days.length?<div className="empty-state"><h3>확인 가능한 운동 기록이 아직 없어요.</h3><p>기록을 연결하면 수업일별 세트와 볼륨 추이가 표시돼요.</p><button onClick={onGoal}>훈련 목표 설정</button></div>:<><div className="ps-metrics"><div><span>수업일당 평균 세트</span><strong>{format(stats.averageSets)}<small>세트</small></strong></div><div><span>수업일당 평균 볼륨</span><strong>{format(stats.averageVolume)}<small>kg·회</small></strong></div><div><span>기간 총 세트</span><strong>{format(stats.sets)}<small>세트</small></strong></div></div>
 <div className="ps-chart"><div className="ps-chart-heading"><div className="ps-filter">{[['sets','세트 수'],['volume','볼륨']].map(([id,label])=><button key={id} aria-pressed={metric===id} onClick={()=>setMetric(id as typeof metric)}>{label}</button>)}</div><div className="ps-filter" aria-label="범위 종류"><button aria-pressed={band==='plan'} onClick={()=>setBand('plan')}>계획 범위</button><button aria-pressed={band==='observed'} onClick={()=>setBand('observed')}>관찰 범위</button></div></div>
 <ChartRecordHover metric={metric} onOpenRecord={onOriginalRecord??onEvidence} points={days.map((d,i)=>({...d,...sessionChartContext(stats.records,d.date,sessionNotes.find(n=>n.date===d.date)),x:x(i)/680*100,y:value(d)===null?null:y(value(d)!)/266*100}))}><svg viewBox="0 0 680 266" role="img" aria-label={`수업일별 ${metric==='sets'?'세트 수':'볼륨'} 추이. ${band==='observed'?'관찰 범위는 적정 기준이 아닙니다.':hasPlan?'확인된 계획 범위와 비교합니다.':'계획 범위 미설정.'}`}>
 {[0,.5,1].map(r=><g key={r}><line x1={55} x2={635} y1={y(r*max)} y2={y(r*max)} stroke="#e2e8de"/><text x={45} y={y(r*max)+4} textAnchor="end" fill="#7e897b" fontSize={11}>{format(Math.round(r*max))}</text></g>)}
 {days.map((d,i)=>{const r=band==='plan'?planned[i]:observation;if(!r)return null;const left=i===0?55:(x(i-1)+x(i))/2,right=i===days.length-1?635:(x(i)+x(i+1))/2;return <rect key={d.date} x={left} y={y(r.max)} width={right-left} height={Math.max(1,y(r.min)-y(r.max))} fill={band==='plan'?'#dce9d2':'#e9e9e5'}/>;})}
 {paths.map((d,i)=><path key={i} d={d} stroke="#355d43" strokeWidth={2.5} fill="none"/>)}{days.map((d,i)=><g key={d.date}>{value(d)!==null&&<circle cx={x(i)} cy={y(value(d)!)} r={selectedDay?.date===d.date?5:3.5} fill="white" stroke="#355d43" strokeWidth={2}/>}</g>)}
 </svg></ChartRecordHover><div className="ps-legend"><span>━ 실제 기록 · {unit}</span><span><i style={{background:band==='plan'?'#dce9d2':'#e9e9e5'}}/>{band==='plan'?'트레이너 확인 범위':'관찰 범위 · 중간 50% · 적정 기준 아님'}</span></div>
 {(band==='plan'&&!hasPlan||band==='observed'&&!observation)&&<p className="ps-help">{band==='plan'?<><button onClick={onGoal}>계획 범위 설정</button></>:'관찰 범위는 해당 수치가 있는 수업일이 5일 이상일 때 표시해요.'}</p>}
 <div className="ps-selection"><div className="ps-day-select"><span>수업일</span><WorkoutSelect label="요약 그래프 수업일" value={selectedDay?.date??''} onChange={setSelected} options={days.map(d=>({value:d.date,label:d.date}))}/></div><span>{format(selectedValue)} {unit} · {band==='plan'?status:range?'관찰 범위와 비교':'관찰 기록 부족'}</span></div></div>
 {judged&&<section className="ps-comment"><div><span><Icon name="chart" size={15}/> 계획 대비 기록</span><span className="pill">{outsideDays?'범위 이탈':'범위 내'}</span></div><h3>{headline}</h3>{judged&&<small className="record-help">{goal?.plan.sets?'세트':''}{goal?.plan.sets&&goal?.plan.volume?'·':''}{goal?.plan.volume?'볼륨':''} · 트레이너 설정 범위 비교</small>}</section>}
 <section className="ps-body"><div className="section-title"><h2>부위별 운동 분포</h2>{onBody&&<button onClick={()=>onBody?.()}>배분 상세 →</button>}</div><BodyMap cardio={cardioDistribution(stats.records)} stats={sourceStats} compact hideDetails={!!onBody} onPartSelect={onBody} sourceLabel="실제 운동 기록" onSource={date=>{const r=stats.records.find(r=>r.date===date);if(r)onEvidence(r.id);}}/>{distributionComment&&<p className="ps-body-comment">{distributionComment}</p>}</section>
 </>}{stats.excludedRecords>0&&<p className="ps-help">입력 확인이 필요한 기록 {stats.excludedRecords}개는 집계에서 제외했어요.</p>}</div>;
}
