"use client";
import {RegionChangeCard,evidenceRegion,type ChangeRegion,type ChangeEvidence} from './change-evidence-card';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {callAi,aiMessage,type SavedPlan} from '../lib/server-ai';
import {formatWorkoutSet,type MeasurementType,type WorkoutSet} from '../lib/workout-measurements';
type Evidence=ChangeEvidence;
type Direction={id:string;kind:'keep'|'adjust'|'check'|'measure';text:string;reason?:string;check?:string;evidenceIds:string[]};
const directionLabels={keep:'유지할 것',adjust:'조정할 것',check:'확인할 것',measure:'다시 볼 지표'};
type Report={warnings?:string[];headline:string;regionalComments?:{region:ChangeRegion;comment:string;evidenceIds:string[]}[];findings:{evidenceId:string;interpretation:string;uncertainty:string}[];directions:Direction[]};
type Item={id:string;exerciseName:string;measurementType:MeasurementType;loadType:string;referenceDate:string;reference:string;segments:WorkoutSet[];reason:string;recovery:string};
type Cycle={title:string;inputKey:string;options:{count:number;frequency:number;minutes:number;equipment:string;directions:{id:string;text:string}[]};sessions:{number:number;focus:string;progressWhen:string;adjustWhen:string;checks:string[];items:Item[]}[]};
type Context={inputKey:string;records:number;days:number;from:string;to:string;excluded:number;sessionNotes?:{date:string;text:string}[];evidence:Evidence[];report:Report|null;status:string;error:string;goal:string;savedPlan:{plan:Cycle;revision:number;proposalId:string;inputKey:string}|null};
export function CoachingJourney({request=callAi,legacyPlan,memberId,revision,stage,online,onStage,onOriginal,onDetails,onGoal,onAsk,onTrendRecord,onRegionDetails,recordParts={}}:{request?:typeof callAi;legacyPlan:SavedPlan|null;memberId:string;revision:string;stage:'analysis'|'direction'|'plan';online:boolean;onStage:(stage:'analysis'|'direction'|'plan')=>void;onOriginal:(id:string)=>void;onDetails:()=>void;onGoal:()=>void;recordParts?:Record<string,string>;onRegionDetails?:(region:ChangeRegion,details:{title:string;text:string}[])=>void;onAsk?:(question:string,id:string)=>void;onTrendRecord?:(id:string,metric:string)=>void}){
 const [context,setContext]=useState<Context|null>(null),[busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[chosen,setChosen]=useState<Record<string,string>>({}),[count,setCount]=useState(4),[frequency,setFrequency]=useState(2),[minutes,setMinutes]=useState(50),[equipment,setEquipment]=useState(''),[proposal,setProposal]=useState<{id:string;plan:Cycle}|null>(null);
 const [pendingProposal,setPendingProposal]=useState('');
 const [editingPlan,setEditingPlan]=useState(false);
 const planTop=useRef<HTMLDivElement>(null);
 const directionDrafts=useRef<Record<string,string>>({});
 function receiveDirections(c:Context){
  const key=JSON.stringify([memberId,c.inputKey,c.report]);
  if(directionKey.current===key)return;
  const initial=Object.fromEntries((c.report?.directions??[]).map(d=>[d.id,d.text]));
  directionDrafts.current=initial;setChosen(initial);directionKey.current=key;
 }
 const progressRef=useRef<HTMLDivElement>(null);
 const epoch=useRef(0),lock=useRef(false),directionKey=useRef(''),contextEpoch=useRef(-1),autoAttempt=useRef('');
 useEffect(()=>{let live=true;epoch.current++;lock.current=false;setBusy('');setContext(null);setProposal(null);setEditingPlan(false);setPendingProposal('');setError('');if(!online)return;void request({action:'workflowContext',memberId}).then(value=>{if(!live)return;const c=value as unknown as Context;contextEpoch.current=epoch.current;setContext(c);if(c.status==='error')setError(c.error||'분석을 완료하지 못했어요. 다시 시도해주세요.');receiveDirections(c);}).catch(e=>{if(live)setError(aiMessage(e));});return()=>{live=false;epoch.current++;};},[memberId,revision,online,refresh,request]);
 async function analyze(){if(!context||lock.current)return;lock.current=true;setBusy('회원의 변화를 해석하고 다음 기간의 방향을 함께 제안하고 있어요');polling.current=0;setNotice('');setError('');const token=epoch.current;try{const c=await request({action:'analyzeChanges',memberId,inputKey:context.inputKey,retry:context.status==='error'}) as unknown as Context&{stale?:boolean};if(token!==epoch.current)return;if(c.stale)throw Error('기록이 바뀌었어요. 새로 확인한 뒤 분석해주세요.');setContext(c);if(c.status==='error')throw Error(c.error||'분석을 완료하지 못했어요. 다시 시도해주세요.');if(c.status==='processing'){setNotice('');return;}receiveDirections(c);}catch(e){if(token===epoch.current){setError(aiMessage(e));try{const current=await request({action:'workflowContext',memberId}) as unknown as Context;if(token===epoch.current)setContext(current);}catch{/* Keep the original error if the status read also fails. */}}}finally{if(token===epoch.current){lock.current=false;setBusy('');}}}

 // Start once per loaded context; cached reports and in-flight jobs never trigger another paid call.
 useEffect(()=>{
  if(!online||stage!=='analysis'||!context||contextEpoch.current!==epoch.current||context.report||context.status!=='reference'||!context.evidence.length||busy||error||lock.current)return;
  const key=`${memberId}:${context.inputKey}:${epoch.current}`;
  if(autoAttempt.current===key)return;
  autoAttempt.current=key;void analyze();
 });
 async function generate(){if(!context||lock.current)return;lock.current=true;setBusy(`${count}회 수업의 구성과 진행 조건을 만들고 있어요`);setError('');setNotice('');const token=epoch.current;try{const v=await request({action:'generateCycle',memberId,inputKey:context.inputKey,options:{count,frequency,minutes,equipment,directions:Object.entries(chosen).map(([id,text])=>({id,text}))}}) as unknown as {stale?:boolean;status:string;proposalId:string;plan:Cycle};if(token!==epoch.current)return;if(v.stale)throw Error('기록이 바뀌었어요. 회원 변화를 다시 확인해주세요.');if(v.status==='processing'){setPendingProposal(v.proposalId);polling.current=0;return;}if(!v.plan)throw Error('계획 생성에 실패했어요. 다시 시도해주세요.');setProposal({id:v.proposalId,plan:v.plan});setEditingPlan(false);}catch(e){if(token===epoch.current)setError(aiMessage(e));}finally{if(token===epoch.current){lock.current=false;setBusy('');}}}
 async function save(){if(!context||!proposal||lock.current)return;lock.current=true;setBusy('계획 저장 중');setError('');const token=epoch.current;try{await request({action:'saveCycle',memberId,inputKey:context.inputKey,proposalId:proposal.id,revision:context.savedPlan?.revision??0});if(token!==epoch.current)return;setContext({...context,savedPlan:{plan:proposal.plan,revision:(context.savedPlan?.revision??0)+1,proposalId:proposal.id,inputKey:context.inputKey}});setProposal(null);setNotice('수업 계획을 저장했습니다. 새 수행 기록을 추가하면 남은 계획을 다시 검토할 수 있어요.');}catch(e){if(token===epoch.current)setError(aiMessage(e));}finally{if(token===epoch.current){lock.current=false;setBusy('');}}}
 const polling=useRef(0);
 useEffect(()=>{if(!online||error||(!pendingProposal&&context?.status!=='processing')||busy)return;
  if(polling.current>=40){setError('처리가 오래 걸리고 있어요. 잠시 후 다시 확인해주세요.');return;}
  const token=epoch.current;let live=true;const timer=setTimeout(async()=>{polling.current++;try{
   if(pendingProposal){const v=await request({action:'cycleStatus',memberId,inputKey:context?.inputKey,proposalId:pendingProposal}) as unknown as {stale?:boolean;status:string;plan:Cycle;error?:string};if(!live||token!==epoch.current)return;if(v.stale)throw Error('기록이 바뀌었어요. 최신 기록을 다시 확인해주세요.');if(v.status==='ready'){setProposal({id:pendingProposal,plan:v.plan});setEditingPlan(false);setPendingProposal('');}else if(v.status==='error'||v.status==='missing')throw Error(v.error||'계획을 다시 제안받아주세요.');else setContext(c=>c?{...c}:c);
   }else{const c=await request({action:'workflowContext',memberId}) as unknown as Context;if(!live||token!==epoch.current)return;if(c.inputKey!==context?.inputKey)throw Error('기록이 바뀌었어요. 최신 기록을 다시 확인해주세요.');setContext(c);if(c.status==='error')throw Error(c.error||'분석을 다시 시도해주세요.');if(c.report)receiveDirections(c);}
  }catch(e){if(live&&token===epoch.current){setPendingProposal('');setError(aiMessage(e));}}},4000);return()=>{live=false;clearTimeout(timer);};
 },[context,pendingProposal,online,error,busy,request,memberId]);
 const working=online&&!error&&(!!busy||!!pendingProposal||context?.status==='processing'||!context);
 useEffect(()=>{if(working)progressRef.current?.scrollIntoView({block:'center',behavior:'smooth'});},[working]);

 const proposedOptions=proposal?.plan.options;
 const proposalChanged=!!proposedOptions&&(proposedOptions.count!==count||proposedOptions.frequency!==frequency||proposedOptions.minutes!==minutes||proposedOptions.equipment!==equipment.trim()||proposedOptions.directions.length!==Object.keys(chosen).length||proposedOptions.directions.some(d=>chosen[d.id]?.trim()!==d.text));
 const plan=proposal?.plan??context?.savedPlan?.plan;
 const showingPlan=!!plan&&!editingPlan;
 useEffect(()=>{if(stage==='plan'&&!working)planTop.current?.scrollIntoView({block:'start',behavior:'smooth'});},[stage,showingPlan,working]);
 return <section className={"coaching-journey "+(stage==='analysis'?'journey-brief':stage==='plan'?'journey-plan':'')} aria-label="회원 변화와 수업 계획">
 {error&&<JourneyError message={error}>{context?.status==='error'&&!context.report?<button disabled={!!busy} onClick={()=>void analyze()}>분석 다시 시도</button>:<button disabled={!!busy} onClick={()=>setRefresh(v=>v+1)}>최신 기록 다시 확인</button>}</JourneyError>}
 {!online&&<p role="status">연결 후 저장된 분석과 계획을 확인할 수 있어요.</p>}

 {working&&<div ref={progressRef}><JourneyProgress title={!context?"기록을 불러오고 있어요":pendingProposal||busy.includes("수업의")?"수업 계획을 구성하고 있어요":busy.includes("저장")?"계획을 저장하고 있어요":"회원 변화를 분석하고 있어요"} description={busy||(!context?"저장된 기록과 분석 상태를 확인합니다.":"전체 기간의 기록을 비교하고 있습니다.")} /></div>}{notice&&<p role="status">{notice}</p>}
 {context&&!working&&<><details className="journey-record-summary" ><summary>기록 요약 · {context.days}개 기록일 · {context.records}개 운동</summary><p>{context.from||'기록 없음'} — {context.to} · 전체 확인 가능 기록 기준</p><p>{context.excluded?`미확인·제외 기록 ${context.excluded}개는 분석에서 제외했습니다.`:'저장된 분석 대상 기록을 사용합니다.'} 사진의 누락 여부는 원본과 함께 확인하세요.</p><button onClick={onGoal}>{context.goal?`목표: ${context.goal}`:'회원 목표·배경 확인'}</button></details>
 {stage==='analysis'&&<>{context.report?.warnings?.map((warning,i)=><p className="direction-context" role="status" key={i}>{warning}</p>)}{context.report&&<p className="brief-headline brief-result">{context.report.headline}</p>}{!context.evidence.length&&<p>분석할 기록이 없습니다. 기록 확인에서 운동 기록을 추가해주세요.</p>}

 {context.report&&<ChangeCards evidence={context.evidence} report={context.report} recordParts={recordParts} onAsk={onAsk} onDetails={(e,region)=>{if(onRegionDetails)onRegionDetails(region,(context.report?.findings??[]).flatMap(f=>{const item=context.evidence.find(e=>e.id===f.evidenceId);return item&&evidenceRegion(item,recordParts)===region?[{title:item.name+" · "+item.label,text:f.interpretation+" "+f.uncertainty}]:[];}));else if(e&&onTrendRecord)onTrendRecord(e.recordIds[0],e.metric??'volume');else onDetails();}}/>}
 {context.report&&<article className="region-change-card region-next"><h3>다음 기간의 방향 제안</h3><ul>{context.report.directions.map(d=><li key={d.id}>{d.text}</li>)}</ul></article>}
 <div className="journey-actions journey-next-step"><button className="primary" disabled={!context.report} onClick={()=>onStage('direction')}>다음 기간의 방향 →</button></div>
 </>}

 {stage==='direction'&&<>{context.report&&<p className="direction-context">회원 변화에서 제안한 방향입니다. 필요한 내용을 선택하거나 수정해주세요.</p>}{!context.report&&<button onClick={()=>onStage('analysis')}>회원 변화 먼저 분석하기</button>}{context.report?.directions.map((d,index)=><article className="journey-card direction-choice" key={d.id}><div className="direction-suggestion-label"><strong>{directionLabels[d.kind]}</strong><small>AI 제안</small></div>{d.reason&&<p className="direction-reason">{d.reason}</p>}<label><input type="checkbox" checked={Object.hasOwn(chosen,d.id)} onChange={e=>setChosen(old=>{const next={...old};if(e.target.checked)next[d.id]=directionDrafts.current[d.id]??d.text;else delete next[d.id];return next;})}/><span>다음 수업에 반영</span></label><textarea aria-label={`지도 내용 ${index+1} 수정`} maxLength={400} disabled={!Object.hasOwn(chosen,d.id)||!!busy} value={chosen[d.id]??directionDrafts.current[d.id]??d.text} onChange={e=>{const value=e.target.value;directionDrafts.current={...directionDrafts.current,[d.id]:value};setChosen(old=>({...old,[d.id]:value}));}}/>{d.check&&<p className="direction-check"><strong>다음 확인 기준</strong>{d.check}</p>}<details><summary>근거 기록 보기</summary>{d.evidenceIds.map(id=>{const e=context.evidence.find(e=>e.id===id);return e?<p key={id}>{e.name} · {e.observation}</p>:null;})}</details></article>)}<div className="journey-actions"><button onClick={()=>onStage('analysis')}>← 회원 변화</button><button className="primary" disabled={!Object.keys(chosen).length||Object.values(chosen).some(v=>!v.trim())} onClick={()=>onStage('plan')}>선택한 내용으로 수업 계획 →</button></div></>}
 {stage==='plan'&&<><div ref={planTop} className="plan-view-toolbar">{plan&&<button onClick={()=>setEditingPlan(v=>!v)}>{editingPlan?'작성된 계획 보기 →':'← 수업 설정 수정'}</button>}</div>{!showingPlan&&<><fieldset disabled={!!busy} className="journey-settings"><legend>수업 설정</legend><label>계획할 수업<select value={count} onChange={e=>setCount(Number(e.target.value))}>{[1,4,8].map(n=><option key={n} value={n}>{n}회</option>)}</select></label><label>주당 횟수<input type="number" min={1} max={7} value={frequency} onChange={e=>setFrequency(Number(e.target.value))}/></label><label>회당 시간(분)<input type="number" min={10} max={180} value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/></label><label>기구·환경 조건 <small>선택</small><input maxLength={500} value={equipment} placeholder="미입력 시 기록에 있는 기구 참고" onChange={e=>setEquipment(e.target.value)}/></label></fieldset>
 <section className="plan-directions" aria-label="선택한 방향"><div className="plan-directions-heading">선택한 방향 <span>{Object.keys(chosen).length}개</span></div><ul>{Object.values(chosen).map((v,i)=><li key={i}>{v}</li>)}</ul></section><div className="journey-actions plan-submit"><button onClick={()=>onStage('direction')}>← 방향 수정</button><button className="primary" disabled={!!busy||!context.report||!Object.keys(chosen).length||Object.values(chosen).some(v=>!v.trim())||frequency<1||frequency>7||minutes<10||minutes>180} onClick={()=>void generate()}>{count}회 계획 제안받기 →</button></div></>}

 {context.savedPlan&&context.savedPlan.inputKey!==context.inputKey&&<p role="status">저장한 계획 이후 기록이 바뀌었습니다. 기존 계획을 보존했으며, 최신 분석으로 새 제안을 받을 수 있습니다.</p>}
 {proposalChanged&&<p role="status">설정이나 방향이 바뀌었습니다. 수업 설정에서 계획을 다시 제안받아주세요.</p>}{proposal&&showingPlan&&<p role="status">새 제안입니다. 아래 계획을 검토하고 저장하면 현재 수업 계획에 반영됩니다.</p>}
 {plan&&showingPlan&&<><div className="journey-heading"><h3>{plan.title}</h3><span>{proposal?'저장 전 제안':'저장된 계획'} · {plan.options.count}회 · 주 {plan.options.frequency}회 · {plan.options.minutes}분</span></div><details><summary>이 계획에 반영한 방향</summary><ul>{plan.options.directions.map(d=><li key={d.id}>{d.text}</li>)}</ul></details>{plan.sessions.map(s=><article className="journey-card" key={s.number}><h3>{s.number}회 · {s.focus}</h3><small>{s.number===1?'다음 수업 제안':'수행 결과에 따라 조정할 초안'}</small>{s.items.map((item,i)=><details key={item.id} open={s.number===1}><summary>{i+1}. {item.exerciseName} · {item.segments.length}{item.measurementType==='repetitions'?'세트':'구간'}</summary><p><strong>제안값</strong> · {item.segments.map(s=>formatWorkoutSet({measurementType:item.measurementType,loadType:item.loadType,sets:item.segments},s)).join(' / ')}</p><p className="journey-limit">참고 기록 {item.referenceDate} · {item.reference}</p><p>{item.reason}</p>{item.recovery&&<p>{item.recovery}</p>}<button onClick={()=>onOriginal(item.id)}>참고 원본</button></details>)}<p><strong>진행 조건</strong> · {s.progressWhen}</p><p><strong>유지·조정 조건</strong> · {s.adjustWhen}</p><ul>{s.checks.map((c,i)=><li key={i}>{c}</li>)}</ul></article>)}{proposal&&<div className="journey-actions"><button disabled={!!busy} onClick={()=>setProposal(null)}>{context.savedPlan?'제안 닫고 저장된 계획 보기':'제안 닫고 설정으로 돌아가기'}</button><button className="primary" disabled={!!busy||proposalChanged} onClick={()=>void save()}>검토한 계획 저장</button></div>}</>}
 {legacyPlan&&<details className="plan-legacy"><summary>이전에 저장한 1회 수업 계획</summary>{legacyPlan.program.map((p,i)=><p key={i}>{p.exerciseName} · {p.sets}세트 · {p.reps}</p>)}</details>}
 </>}
 </>}
 </section>;
}

export function JourneyError({message,children}:{message:string;children:ReactNode}){
 const code=message.match(/\s*\[(\d{3})\]\s*$/)?.[1];
 const description=code?message.replace(/\s*\[\d{3}\]\s*$/,''):message;
 return <div className="journey-error" role="alert">
  <span className="journey-error-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3v.1"/></svg></span>
  <div className="journey-error-content"><strong>작업을 완료하지 못했어요</strong><p>{description}</p>
   <div className="journey-error-actions">{children}{code&&<details><summary>오류 상세</summary><span>응답 코드 {code}</span></details>}</div>
  </div>
 </div>;
}

export function JourneyProgress({title,description}:{title:string;description:string}){
 const [seconds,setSeconds]=useState(0);useEffect(()=>{setSeconds(0);const timer=setInterval(()=>setSeconds(v=>v+1),1000);return()=>clearInterval(timer);},[title]);
 const percent=Math.min(95,Math.round(5+90*(1-Math.exp(-seconds/30))));
 return <div className="journey-progress" role="status" aria-live="polite"><span className="journey-progress-symbol" aria-hidden="true">↗</span><h2>{title}</h2><p>{description}</p><div className="journey-progress-meter"><div className="journey-progress-track" role="progressbar" aria-label="예상 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`예상 진행률 ${percent}%`}><span style={{width:`${percent}%`}}/></div><span className="journey-progress-percent" aria-live="off">{percent}% <small>진행률</small></span></div><small>{seconds<20?'완료되면 결과가 자동으로 표시됩니다.':seconds<60?'기록이 많으면 조금 더 걸릴 수 있어요.': '계속 처리 중입니다. 완료 전에는 결과를 확정하지 않습니다.'}</small></div>;
}

function ChangeCards({evidence,report,recordParts,onDetails,onAsk}:{evidence:Evidence[];report:Report|null;recordParts:Record<string,string>;onDetails:(e:Evidence|undefined,region:ChangeRegion)=>void;onAsk?:(question:string,id:string)=>void}){
 return <section className="region-cards" aria-label="영역별 회원 변화">{(['하체','상체','코어','유산소'] as ChangeRegion[]).map(region=><RegionChangeCard key={region} region={region} evidence={evidence.filter(e=>evidenceRegion(e,recordParts)===region)} findings={report?.findings??[]} comment={report?.regionalComments?.find(c=>c.region===region)?.comment} onDetails={onDetails} onAsk={onAsk}/>)}</section>;
}
