"use client";
import {useEffect,useRef,useState} from 'react';
import {callAi,aiMessage} from '../lib/server-ai';
import {ASSESSMENT_SOURCES,validateAssessmentDraft,type TrainingAssessment,type AssessmentDraft} from '../lib/training-assessment';
import {AssessmentFieldEditor} from './assessment-field-editor';
import {appendFollowupAnswer,followupPlaceholder} from '../lib/assessment-followup';
import {GoalFieldHelp} from './goal-field-help';
import {Icon} from './icons';
export function TrainingAssessmentEditor({value,onChange,goal,initialState,memberId,online,onBusy}:{value:TrainingAssessment|null;onChange:(v:TrainingAssessment|null)=>void;goal:string;initialState:string;memberId:string;online:boolean;onBusy:(v:boolean)=>void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[answer,setAnswer]=useState('');const alive=useRef(true),pending=useRef(false);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const mode=value?.mode??'later',draft=value?.draft;
 function patch(v:Partial<TrainingAssessment>){if(value)onChange({...value,...v});setError('');}
 function editDraft(v:Partial<AssessmentDraft>){if(draft)patch({draft:{...draft,...v},confirmed:false});}
 useEffect(()=>{setAnswer('');},[value?.description,value?.mode]);
 async function organize(){if(!value||pending.current)return;pending.current=true;setBusy(true);onBusy(true);setError('');try{const submitted=appendFollowupAnswer(value.answers,answer,draft?.questions??[]);const result=await callAi({action:'draftAssessment',memberId,mode:value.mode,description:value.description,answers:submitted,goal,initialState}) as {draft?:unknown};const parsed=validateAssessmentDraft(result.draft);if(alive.current){onChange({...value,answers:submitted,draft:parsed,confirmed:false});setAnswer('');}}catch(e){if(alive.current)setError(aiMessage(e));}finally{pending.current=false;if(alive.current){setBusy(false);onBusy(false);}}}
 const source=ASSESSMENT_SOURCES.find(s=>s.id===draft?.sourceId);
 const descriptionInput=value?<><label>{mode==='own'?'평소 어떻게 평가하시나요?':'회원 상황과 사용할 장비'}<textarea rows={4} maxLength={3000} value={value.description} onChange={e=>patch({description:e.target.value,draft:null,answers:'',confirmed:false})} placeholder={mode==='own'?'예: 마이마운틴 기울기 20, 속도 5로 1분 달리고 기울기 0, 속도 3으로 걸어요. 이를 10번 반복하는 게 목표예요.':'예: 35세, 운동 초보, 레그프레스·로잉머신 이용 가능. 현재 수행과 운동 제한도 적어주세요.'}/></label><button type="button" className="ta-organize" disabled={!online||mode==='own'&&!value.description.trim()} onClick={()=>void organize()}><Icon name="spark" size={16}/>{busy?'평가 방법 정리 중…':draft?'다시 정리':'AI로 '+(mode==='own'?'정리하기':'추천받기')}</button></>:null;
 return <div className="ta-editor"><fieldset disabled={busy} aria-label="평가 방식 선택"><GoalFieldHelp title="평가 방식 선택" label={<span>평가 방식</span>} description="내 평가 방식은 평소 쓰는 테스트를 AI로 정리. 평가 추천은 회원 상황·장비에 맞는 방법을 제안받아 확인. 나중에 설정은 목표부터 저장하고 평가 방법은 추후 추가." example="예: 정해둔 마이마운틴 인터벌이 있다면 ‘내 평가 방식’ 선택"/><div className="ta-paths">{[['own','내 평가 방식','평소 쓰는 방법을 설명'],['recommend','평가 추천','목표·장비에 맞는 방법'],['later','나중에 설정','목표부터 저장']].map(([id,title,desc])=><button type="button" key={id} aria-pressed={mode===id} onClick={()=>{onChange(id==='later'?null:{mode:id as 'own'|'recommend',description:'',answers:'',draft:null,confirmed:false});setError('');}}><strong>{title}</strong><small>{desc}</small></button>)}</div>
 {draft?<details className="ta-original"><summary>입력한 설명 수정</summary>{descriptionInput}</details>:descriptionInput}
 </fieldset>
 {error&&<p className="file-error" role="alert">{error}</p>}
 {draft&&value&&<div className="ta-draft"><header><span>{source?'연구 기반 제안':mode==='recommend'?'평가 추천 · 정보 확인':'트레이너 지정 평가'} · {value.confirmed?'확인 완료':'확인 전'}</span><h3>{draft.title}</h3><p>{draft.purpose}</p></header>
 {draft.steps.length>0&&<ol className="ta-steps">{draft.steps.map((s,i)=><li key={i}><strong>{s.name}</strong><span>{s.details||'조건 확인 필요'}</span></li>)}</ol>}
 <dl className="ta-facts"><div><dt>목표</dt><dd>{draft.target||'첫 평가 후 설정'}</dd></div><div><dt>기록할 항목</dt><dd>{draft.measures.join(' · ')||'확인 필요'}</dd></div>{draft.conditions.length>0&&<div><dt>같게 맞출 조건</dt><dd>{draft.conditions.join(' · ')}</dd></div>}</dl>
 {source&&<details className="ta-source"><summary>근거·적용 대상</summary><p>{source.scope}</p><a href={source.url} target="_blank" rel="noreferrer">연구·평가 방법 보기 ↗</a></details>}
 {draft.questions.length>0?<div className="ta-questions"><h4>이것만 더 확인해주세요</h4><ul>{draft.questions.map(q=><li key={q}>{q}</li>)}</ul><label>추가 답변<textarea rows={3} maxLength={2000} disabled={busy} value={answer} onChange={e=>setAnswer(e.target.value)} placeholder={followupPlaceholder(draft.questions)}/></label><button type="button" className="primary" disabled={busy||!online||!answer.trim()} onClick={()=>void organize()}>{busy?'정리 중…':'답변 반영'}</button><small>조건 확인 전에는 평가 초안으로 저장</small></div>:
 <><details className="ta-edit"><summary>정리한 내용 수정</summary><fieldset disabled={busy}><label>평가 이름<input maxLength={120} value={draft.title} onChange={e=>editDraft({title:e.target.value})}/></label>{draft.steps.map((s,i)=><label key={i}>{s.name}<textarea rows={2} maxLength={600} value={s.details} onChange={e=>editDraft({steps:draft.steps.map((v,n)=>n===i?{...v,details:e.target.value}:v)})}/></label>)}<AssessmentFieldEditor fields={draft.fields??[]} onChange={fields=>editDraft({fields})}/><label>목표값 · 선택<input maxLength={500} value={draft.target} onChange={e=>editDraft({target:e.target.value})} placeholder="예: 동일 조건으로 10라운드 완료"/></label></fieldset></details><GoalFieldHelp title="평가 방법 확인" label={<label className="tg-checkbox ta-confirm"><input type="checkbox" disabled={busy||!draft.steps.length||!draft.measures.length||mode==='recommend'&&!source} checked={value.confirmed} onChange={e=>patch({confirmed:e.target.checked})}/>이 평가 방법으로 진행</label>} description="평가 동작·기구 설정·회복 조건과 기록 항목을 검토한 뒤 선택. 조건이 빠진 상태는 확인 전 초안으로 저장되며, 확인 후 수업별 평가 기록에 사용." example="예: 운동 1분·회복 1분과 속도·기울기 단위를 확인한 뒤 선택"/></>}
 </div>}
 </div>;
}
