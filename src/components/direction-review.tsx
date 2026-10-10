"use client";
import {toFriendlyExplanation} from '../lib/explanation-tone';
import {useState,type ReactNode} from 'react';
import {ResearchText,type CoachingResearch} from './coaching-research-note';
import {CoachingReportOverview} from './coaching-report-overview';
import {GuidanceNote} from './guidance-note';
import {decisionChoiceLabels,type CoachingDecision} from '../lib/server-ai';
export type GuidanceSource={id:string;title:string;url:string;type:string};
export type GoalLens={id:string;label:string;status:'recorded'|'check'|'unknown';observation:string;detail?:string;recordIds:string[];interpretation:string;comparison?:string;recommendation?:string;criteria?:{sourceId:string;title:string;url:string;rows:{label:string;criterion:string}[];note:string};question:string;references:GuidanceSource[]};
export type GoalReview={publicResearch?:CoachingResearch;summary:string;reason:string;nextStep:string;evidenceIds:string[];references:GuidanceSource[];lenses?:GoalLens[]};
export type Direction={id:string;goalAspect?:string|null;scopeObservation?:string;kind:'keep'|'adjust'|'check'|'measure';text:string;reason?:string;check?:string;evidenceIds:string[]};
export type DiscussTarget={kind:'lens'|'direction';id:string;label:string;fingerprint:string};
const aspects:Record<string,string>={muscles:'큰 근육군 참여',aerobic:'유산소 구성',resistance:'반복수·부하 구성',core:'코어의 역할',placement:'배치·회복',outcomes:'목표 변화 확인'};
const statuses={recorded:'기록 확인',check:'추가 확인',unknown:'정보 없음'};
// Which of the member's goals a lens mainly serves. Falls back to the primary goal.
const aspectGoals:Record<string,string[]>={muscles:['근비대','근력','다이어트(체지방 감소)'],aerobic:['심폐·체력','다이어트(체지방 감소)'],resistance:['근력','근비대'],core:['심폐·체력','좌우 균형 발전'],placement:['근력','심폐·체력'],outcomes:['다이어트(체지방 감소)','근비대']};
export function aspectGoal(aspect:string|null|undefined,goals:string[]){return (aspectGoals[aspect??'']??[]).find(g=>goals.includes(g))??goals[0]??'';}
export type AppliedDecision={id:string;version:string};
type DecisionState='shown'|'applied'|'moved'|'older';
/** shown: overlays the same card it was decided on. applied: the current synthesis was given it (id + revision).
 *  moved: same records, but the analysis was re-run and that card is gone. older: decided on other records. */
export function decisionState(d:CoachingDecision,inputKey:string,applied:AppliedDecision[],fingerprints:Record<string,string>):DecisionState{
 if(applied.some(a=>a.id===d.id&&a.version===d.version))return 'applied';
 if(d.inputKey!==inputKey)return 'older';
 return fingerprints[`${d.target.kind}:${d.target.id}`]===d.fingerprint?'shown':'moved';
}
export function activeDecisions(decisions:CoachingDecision[],inputKey:string,applied:AppliedDecision[],fingerprints:Record<string,string>){return decisions.filter(d=>decisionState(d,inputKey,applied,fingerprints)==='shown');}
const stateLabels:Record<DecisionState,string>={shown:'이번 분석에 표시 중',applied:'종합 판단에 반영됨',moved:'분석이 다시 생성되어 해당 카드가 바뀜 · 재분석 때 참고',older:'이전 기록 기준 결정 · 재분석 때 참고'};
// Highlight a complete lead sentence while preserving verified citation links.
function DirectionKeyPoint({text,research}:{text:string;research?:CoachingResearch}){
 const value=toFriendlyExplanation(text);
 const end=value.search(/[.!?](?:\s|$)/);
 const split=end<0?value.length:end+1;
 return <><mark className="report-key-point"><ResearchText text={value.slice(0,split)} research={research}/></mark><ResearchText text={value.slice(split)} research={research}/></>;
}
export function DirectionReview({goal,secondary,window,review,headline,checks=[],directions,chosen,onToggle,onEdit,trainerContext,onGoal,onOriginal,onAsk,onRemoveDecision,decisions=[],inputKey='',appliedDecisions=[],targetFingerprints={},onPlan,onBack,canAnalyze,conversation}:{headline?:string;conversation?:ReactNode;checks?:Pick<GoalLens,'id'|'label'|'status'|'observation'|'recordIds'|'detail'>[];goal:string;secondary?:string;window?:{from:string;to:string}|null;review?:GoalReview|null;directions:Direction[];chosen:Record<string,string>;onToggle:(id:string,selected:boolean)=>void;onEdit:(id:string,text:string)=>void;trainerContext:{text:string;revision:number};onGoal:()=>void;onOriginal:(id:string)=>void;onAsk?:(question:string,id:string)=>void;onRemoveDecision?:(id:string,removePrinciple:boolean)=>Promise<void>;decisions?:CoachingDecision[];inputKey?:string;appliedDecisions?:AppliedDecision[];targetFingerprints?:Record<string,string>;onPlan:()=>void;onBack:()=>void;canAnalyze:boolean}){

 const [error,setError]=useState(''),[removing,setRemoving]=useState('');
 const lenses=(review?.lenses??[]).map(lens=>{
  if(lens.id!=='resistance')return lens;
  const check=checks.find(c=>c.id===lens.id);
  return {...lens,...check,label:aspects.resistance,observation:check?.observation??lens.observation.replace(/^횟수 운동 (\d+)세트 중 1–5회 \d+세트 · 상대 강도·지도 의도 별도 확인$/, '횟수 기록 $1세트 · 맨몸 포함 · 유산소 제외')};
 });
 const active=activeDecisions(decisions,inputKey,appliedDecisions,targetFingerprints);
 async function remove(id:string){if(!onRemoveDecision||removing)return;const d=decisions.find(x=>x.id===id);const removePrinciple=!!d?.remember&&globalThis.confirm('이 결정과 함께 저장한 다른 회원 참고 기준도 지울까요?');setRemoving(id);setError('');try{await onRemoveDecision(id,removePrinciple);}catch(e){setError(e instanceof Error?e.message:'되돌리지 못했어요.');}finally{setRemoving('');}}
 return <div className="goal-direction">
  {review?<CoachingReportOverview title="목표를 기준으로 본 수업 제안" heading="h2" headline={headline} review={review} headingAction={<button className="goal-context-link report-goal-link" onClick={onGoal}>{goal||'회원 목표 설정'}{secondary?` · ${secondary}`:''}</button>}/>:<><header className="goal-direction-header"><h2>목표를 기준으로 본 수업 제안</h2></header><p className="direction-context">AI 분석을 실행하면 회원 목표와 기록을 연결한 방향을 확인할 수 있어요.</p></>}
  {active.length>0&&<p className="goal-section-note">이전에 확정한 결정 {active.length}개를 참고하고 있어요. 종합 판단을 갱신하려면 AI 재분석을 사용해주세요.</p>}
  {lenses.length>0&&<details className="goal-checks" aria-label="목표 기준 운동 구성 점검"><summary className="goal-checks-toggle"><span>운동 구성 점검</span><small>근거와 상세 해석</small></summary>{window&&<p className="goal-section-note">{window.from} — {window.to} · 최근 기록 기준 28일</p>}{lenses.map(lens=><details className="goal-check-row" key={lens.id}><summary><span>{lens.label}</span><span className={`goal-status goal-status-${lens.status}`}>{statuses[lens.status]}</span><span className="goal-observation">{toFriendlyExplanation(lens.observation)}</span></summary><div className="goal-check-group"><div className="goal-check-fact"><small>기록에서 확인한 것</small><p>{toFriendlyExplanation(lens.observation)}</p>{lens.detail&&<p>{lens.detail}</p>}{lens.recordIds.length>0&&<button className="goal-context-link" onClick={()=>onOriginal(lens.recordIds[0])}>연결된 운동 기록 →</button>}</div><div className="goal-check-reading"><div><small>목표에 비춰 본 해석</small><GuidanceNote sources={lens.references}/></div><p><ResearchText text={lens.interpretation} research={review?.publicResearch}/></p>{lens.comparison&&<section className="goal-lens-explanation"><h4>기준과 비교</h4>{lens.criteria&&<div className="goal-criteria"><a href={lens.criteria.url} target="_blank" rel="noopener noreferrer">{lens.criteria.title} ↗</a><dl>{lens.criteria.rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.criterion}</dd></div>)}</dl><small>{lens.criteria.note}</small></div>}<p><ResearchText text={lens.comparison} research={review?.publicResearch}/></p></section>}{lens.recommendation&&<section className="goal-lens-explanation"><h4>다음 수업에 적용</h4><p><DirectionKeyPoint text={lens.recommendation} research={review?.publicResearch}/></p></section>}</div></div></details>)}</details>}
  {conversation}
  {review&&<section className="direction-list-panel" aria-label="다음 수업에 반영할 방향"><div className="goal-section-heading"><h3>다음 수업에 반영할 방향</h3><button disabled={Object.keys(chosen).length>=5} onClick={()=>onEdit('manual-'+crypto.randomUUID(),'')}>+ 직접 추가</button></div><p className="goal-section-note">필요한 방향만 남기고 자유롭게 수정하세요. 최대 5개까지 수업 계획에 반영해요.</p><ol>{Object.entries(chosen).map(([id,value],i)=>{const raw=directions.find(d=>d.id===id);return <li key={id}><span className="direction-list-number" aria-hidden="true">{i+1}</span><div><textarea aria-label={`수업 방향 ${i+1}`} rows={2} maxLength={400} value={value} placeholder="다음 수업에서 진행하거나 확인할 내용을 적어주세요." onChange={e=>onEdit(id,e.target.value)}/>{raw&&raw.text===value&&(raw.reason||raw.check)&&<details className="direction-list-background"><summary>제안 배경·확인 조건</summary>{raw.reason&&<p>{toFriendlyExplanation(raw.reason)}</p>}{raw.check&&<p><strong>확인 조건</strong> {toFriendlyExplanation(raw.check)}</p>}</details>}</div><button aria-label={`수업 방향 ${i+1} 삭제`} className="direction-list-remove" onClick={()=>onToggle(id,false)}>×</button></li>;})}</ol>{!Object.keys(chosen).length&&<p>직접 추가하거나 대화에서 방향을 정리해보세요.</p>}</section>}
  {(decisions.length>0||trainerContext.text)&&<details className="goal-previous-context"><summary>이전에 저장한 지도 내용</summary>{trainerContext.text&&<p>{trainerContext.text}</p>}{decisions.map(d=><div key={d.id}><p>{d.target.label} · {decisionChoiceLabels[d.choice]} — {d.reason}</p><small>{stateLabels[decisionState(d,inputKey,appliedDecisions,targetFingerprints)]}</small>{onRemoveDecision&&<button disabled={!!removing} onClick={()=>void remove(d.id)}>되돌리기</button>}</div>)}</details>}
  {error&&<p role="alert">{error}</p>}
  {review&&<div className="direction-reference-footer"><GuidanceNote sources={review.references} label="분석의 참고 근거"/></div>}
  <div className="journey-actions"><button onClick={onBack}>← 회원 변화</button><button className="primary" disabled={!canAnalyze||!review||!Object.keys(chosen).length||Object.values(chosen).some(v=>!v.trim())} onClick={onPlan}>이 방향으로 수업 계획 →</button></div>
 </div>;
}
