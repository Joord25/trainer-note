"use client";
import {useEffect,useRef,useState} from 'react';
import type {WorkoutRecord} from '../lib/workout-records';
import {trainingGoalTitle,type SavedTrainingGoal} from '../lib/training-goals';
import {goalVisualCandidates,type GoalVisualCandidate,type GoalVisualCard,type GoalVisualReport} from '../lib/goal-visual';
import type {AssessmentResult} from '../lib/assessment-results';
import type {PerformanceMetric} from '../lib/progress-analysis';
import {callAi,aiMessage} from '../lib/server-ai';
import {AssessmentResults} from './assessment-results';
import {ChartRecordHover} from './chart-record-hover';
const fmt=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:1});
const statuses={progress:'목표 방향으로 진행',review:'조정 검토',insufficient:'평가 근거 부족'};
export function GoalEvaluation({allRecords,goal,onGoal,onTrend,onOriginal,onSummary,onBody,memberId,online,period,results,notes,report,busy,error,onRetry,onDecision,from='',to='9999-12-31'}:{allRecords:WorkoutRecord[];goal:SavedTrainingGoal|null;onGoal:()=>void;onTrend:(key:string,metric?:PerformanceMetric)=>void;onOriginal:(id:string)=>void;onSummary:()=>void;onBody:(part:string)=>void;memberId:string;online:boolean;period:string;results:AssessmentResult[];notes:{date:string;text:string}[];report:GoalVisualReport|null;busy:boolean;error:string;onRetry:()=>void;onDecision:(choice:string,reason:string)=>void;from?:string;to?:string}){
 const [showResults,setShowResults]=useState(false),[choice,setChoice]=useState(''),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[decisionError,setDecisionError]=useState('');const resultsRef=useRef<HTMLDivElement>(null),lock=useRef(false);
 useEffect(()=>{setChoice(report?.decision?.choice??'');setReason(report?.decision?.reason??'');setDecisionError('');},[report?.fingerprint,report?.decision]);
 if(!goal)return <div className="gv-empty"><h3>목표와 기록을 연결해보세요</h3><p>회원 목표를 설정하면 관련 기록으로 평가를 구성합니다.</p><button className="primary" onClick={onGoal}>목표 설정</button></div>;
 const data=goalVisualCandidates(allRecords,goal,results,notes,period);
 function openResults(){setShowResults(true);requestAnimationFrame(()=>resultsRef.current?.scrollIntoView({block:'nearest',behavior:'smooth'}));}
 async function decide(next:string){if(!report||lock.current||!online)return;setChoice(next);if(next==='adjust'&&!reason.trim())return;lock.current=true;setSaving(true);setDecisionError('');try{await callAi({action:'saveGoalVisualDecision',memberId,period,fingerprint:report.fingerprint,choice:next,reason});onDecision(next,reason);}catch(e){setDecisionError(aiMessage(e));}finally{lock.current=false;setSaving(false);}}
 const cards=report?.cards.flatMap(card=>{const candidate=data.candidates.find(c=>c.id===card.candidateId);return candidate?[{card,candidate}]:[];})??[];
 return <div className="goal-visual">
 <header className="gv-heading"><div><small>이번 단계 목표</small><h3>{goal.primary==='직접 설정'?trainingGoalTitle(goal):[goal.primary,...goal.secondary].join(' · ')}</h3>{goal.detail&&goal.primary!=='직접 설정'&&<details className="gv-goal-detail"><summary>설정한 목표</summary><p>{goal.detail}</p></details>}</div><button onClick={onGoal}>목표 수정</button></header>
 <div className="gv-scope"><span>{data.days}회 수업 근거</span><span>{goal.startMode==='unknown'?'목표 시작일 확인 필요':goal.startMode==='date'?`${goal.startDate.slice(5)}부터 목표 적용`:'첫 기록부터 목표 적용'}</span><button onClick={onGoal}>평가 기준 ↗</button></div>
 {busy&&<div className="gv-loading" role="status"><span className="ai-reading-dot"/><div><strong>목표와 기록을 연결하고 있어요</strong><small>관련 변화 · 수업 메모 · 평가 결과 확인 중</small></div></div>}
 {error&&<div className="file-error" role="alert"><p>{error}</p><button disabled={!online} onClick={onRetry}>다시 분석</button></div>}
 {report&&<section className="gv-verdict" data-status={report.status}><span className="gv-status">{statuses[report.status]}</span><h2>{report.headline}</h2><small>AI 평가 초안 · 선택 기간의 기록 기준</small></section>}
 <div className="gv-cards">{cards.map(({card,candidate})=><article className="gv-card" key={candidate.id}>
 <header><div><span className="gv-goal-label">{card.goal}</span><h3>{candidate.name}</h3><small>{candidate.label}</small></div><span className="gv-card-status" data-status={card.status}>{statuses[card.status]}</span></header>
 <GoalVisualChart allRecords={allRecords} candidate={candidate} format={card.format} onOriginal={candidate.kind==='assessment'?undefined:onOriginal}/>
 <div className="gv-interpretation"><span>{card.interpretationSource==='record-check'?'근거 확인':'AI 해석'}</span><p>{card.interpretation}</p></div>
 <footer><span>{candidate.kind==='distribution'?`${data.days}회 수업 · 세트 비중`:`${new Set(candidate.points.map(p=>p.date)).size}개 날짜 · ${candidate.kind==='assessment'?'평가 기록':'운동 기록'}`}</span><button onClick={()=>candidate.kind==='exercise'?onTrend(candidate.link,candidate.metric):candidate.kind==='distribution'?onBody(candidate.link):candidate.kind==='summary'?onSummary():openResults()}>{candidate.kind==='exercise'?'변화 추이':candidate.kind==='distribution'?'부위별 분포':candidate.kind==='summary'?'요약':'평가 기록'}에서 보기 ↗</button></footer>
 </article>)}</div>
 {report?.missing.length? <div className="gv-missing"><span>다음 평가에서 확인</span><ul>{report.missing.map(m=><li key={m}>{m}</li>)}</ul>{goal.assessment?.confirmed&&<button onClick={openResults}>평가 결과 기록 ＋</button>}</div>:null}
 {report&&cards.length>0&&<section className="gv-next"><h3>다음 수업</h3><ul>{[...new Set(cards.map(c=>c.card.nextStep))].map(s=><li key={s}>{s}</li>)}</ul><div className="gv-decision"><span>트레이너 판단</span>{[['agree','동의'],['adjust','수정'],['hold','보류']].map(([id,label])=><button key={id} disabled={saving||!online} aria-pressed={choice===id} onClick={()=>void decide(id)}>{label}{report.decision?.choice===id?' ✓':''}</button>)}</div>{choice==='adjust'&&<div className="gv-reason"><textarea aria-label="판단 수정 이유" rows={2} maxLength={1000} value={reason} placeholder="어떤 근거로 판단을 바꾸셨나요?" onChange={e=>setReason(e.target.value)}/><button disabled={saving||!online||!reason.trim()} onClick={()=>void decide('adjust')}>판단 저장</button></div>}{decisionError&&<p role="alert" className="file-error">{decisionError}</p>}</section>}
 <div className="gv-secondary">{goal.assessment?.confirmed&&<button aria-expanded={showResults} onClick={()=>setShowResults(v=>!v)}>{showResults?'평가 기록 닫기':'평가 결과 기록·보기'} ＋</button>}<button onClick={onGoal}>목표·평가 방법 수정</button></div>
 {showResults&&goal.assessment?.confirmed&&<div ref={resultsRef}><AssessmentResults memberId={memberId} goal={goal} online={online} from={from} to={to}/></div>}
 </div>;
}
function GoalVisualChart({allRecords,candidate:c,format,onOriginal}:{allRecords:WorkoutRecord[];candidate:GoalVisualCandidate;format:GoalVisualCard['format'];onOriginal?: (id:string)=>void}){
 const first=c.points[0],last=c.points.at(-1)!;if(!first||!last)return null;
 const hasChange=c.points.length>1,change=last.value-first.value;
 if(format==='conditions')return <div className="gv-condition-table"><table><thead><tr><th>날짜</th><th>{c.label}</th><th>수행 조건</th></tr></thead><tbody>{(hasChange?[first,last]:[last]).map(p=><tr key={p.date}><td>{p.date.slice(5)}</td><td>{fmt(p.value)} {c.unit}</td><td>{p.condition}</td></tr>)}</tbody></table></div>;
 if(format==='target'&&c.target!==null){const max=Math.max(last.value,c.target,1);return <div className="gv-target"><div><span>최근 <strong>{fmt(last.value)}<small>{c.unit}</small></strong></span><span>설정 목표 <strong>{fmt(c.target)}<small>{c.unit}</small></strong></span></div><div className="gv-target-track"><span style={{width:last.value/max*100+'%'}}/><i style={{left:c.target/max*100+'%'}}/></div><small>{last.date.slice(5)} · {c.label}</small></div>;}
 const numbers=<div className="gv-numbers">{hasChange&&<div><span>첫 기록 · {first.date.slice(5)}</span><strong>{fmt(first.value)}<small>{c.unit}</small></strong></div>}<div><span>{hasChange?'최근':'기록'} · {last.date.slice(5)}</span><strong>{fmt(last.value)}<small>{c.unit}</small></strong></div>{hasChange&&<div className="gv-delta"><span>변화</span><strong>{change>0?'+':''}{fmt(change)}<small>{c.unit}</small></strong></div>}</div>;
 if(format!=='trend'||!hasChange)return <>{numbers}<p className="gv-condition">{last.condition}</p></>;
 const max=Math.max(...c.points.map(p=>p.value),c.target??0,1)*1.16,points=c.points.map((p,i)=>({...p,x:10+i/(c.points.length-1)*82,y:(155-p.value/max*120)/200*100,sets:0,volume:p.value,notes:p.notes.map(text=>({text,label:'수업·운동 메모'})),sources:onOriginal?[...new Map(p.recordIds.flatMap(id=>{const r=allRecords.find(record=>record.id===id);return r?.sourceHash?[[`${r.sourceHash}:${r.sourcePage}`,{id,label:`${r.sourceName} · ${r.sourcePage}쪽`}] as const]:[];})).values()]:[]}));
 return <>{numbers}<ChartRecordHover points={points} metric="volume" valueLabel={c.label} valueUnit={c.unit} axisY={92} onOpenRecord={onOriginal}><svg viewBox="0 0 520 200" className="gv-chart" role="img" aria-label={`${c.name} ${c.label} 변화 추이`}>{[0,.5,1].map(n=><g key={n}><line x1="48" x2="485" y1={155-n*120} y2={155-n*120} stroke="#e5eadd"/><text x="42" y={159-n*120} textAnchor="end" fill="#82907d" fontSize="10">{fmt(max*n)}</text></g>)}{c.target!==null&&<line x1="48" x2="485" y1={155-c.target/max*120} y2={155-c.target/max*120} stroke="#849b74" strokeDasharray="4 4"/>}<polyline points={points.map(p=>`${p.x*5.2},${p.y*2}`).join(' ')} fill="none" stroke="#355d43" strokeWidth="2.5"/>{points.map(p=><circle key={p.date} cx={p.x*5.2} cy={p.y*2} r="3" fill="white" stroke="#355d43" strokeWidth="2"/>)}</svg></ChartRecordHover></>;
}
