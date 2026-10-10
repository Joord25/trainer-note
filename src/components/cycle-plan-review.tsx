"use client";
import {toFriendlyExplanation} from '../lib/explanation-tone';
import {useEffect,useRef,useState} from 'react';
import {formatWorkoutSet,validMeasurement,type WorkoutSet} from '../lib/workout-measurements';
import type {Cycle} from './coaching-journey';

type Item=Cycle['sessions'][number]['items'][number];
function prescription(item:Item){
 const values=item.segments.map(s=>formatWorkoutSet({...item,sets:item.segments},s));
 const groups:{text:string;count:number}[]=[];
 for(const text of values){const last=groups.at(-1);if(last?.text===text)last.count++;else groups.push({text,count:1});}
 return groups.map(g=>g.text+(g.count>1?` × ${g.count}${item.measurementType==='repetitions'?'세트':'구간'}`:'')).join(' / ');
}
const labels:Record<string,string>={kg:'중량(kg)',reps:'횟수',leftReps:'왼쪽 횟수',rightReps:'오른쪽 횟수',durationSeconds:'시간(초)',distanceMeters:'거리(m)',inclinePercent:'경사(%)',speedKph:'속도(km/h)'};
export function CyclePlanReview({plan,canEdit,onSave,onOriginal,onDirty}:{onDirty?:(dirty:boolean)=>void;plan:Cycle;canEdit:boolean;onSave:(plan:Cycle)=>Promise<void>;onOriginal:(id:string)=>void}){
 const [selected,setSelected]=useState(1),[draft,setDraft]=useState<Cycle|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const dirtyCallback=useRef(onDirty);dirtyCallback.current=onDirty;
 useEffect(()=>{dirtyCallback.current?.(!!draft);return()=>dirtyCallback.current?.(false);},[draft]);
 useEffect(()=>{if(!draft)return;const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[draft]);
 const shown=draft??plan,session=shown.sessions.find(s=>s.number===selected)??shown.sessions[0];
 const candidates=Array.from(new Map(plan.sessions.flatMap(s=>s.items).map(i=>[i.id,i])).values());
 const valid=shown.sessions.every(s=>s.items.length>0&&s.items.length<=10&&new Set(s.items.map(i=>i.id)).size===s.items.length&&s.items.every(i=>validMeasurement({...i,sets:i.segments})));
 function updateItem(index:number,next:Item){setDraft(old=>{const current=old??structuredClone(plan);return {...current,sessions:current.sessions.map(s=>s.number===session.number?{...s,items:s.items.map((item,i)=>i===index?next:item)}:s)};});}
 function setValue(index:number,row:number,key:string,value:string){const item=session.items[index];const segments=item.segments.map((s,i)=>{if(i!==row)return s;const next={...s,[key]:value===''?(key==='kg'&&item.loadType==='mixed'?null:0):Number(value)};if(key==='leftReps'||key==='rightReps')next.reps=(next.leftReps??0)+(next.rightReps??0);return next;});updateItem(index,{...item,segments});}
 async function save(){if(!draft||!valid)return;setSaving(true);setError('');try{await onSave(draft);setDraft(null);}catch(e){setError(e instanceof Error?e.message:'저장하지 못했어요. 다시 시도해주세요.');}finally{setSaving(false);}}
 return <section className="cycle-review" aria-label="회차별 수업 계획">
 <nav className="cycle-session-picker" aria-label="계획 회차">{shown.sessions.map(s=><button key={s.number} aria-pressed={session.number===s.number} onClick={()=>setSelected(s.number)}><strong>{s.number}회</strong><span>{s.focus}</span></button>)}</nav>
 <article className="cycle-session"><header><div><h3>{session.number}회 · {session.focus}</h3><small>{session.number===1?'다음 수업':'수행 결과에 따라 조정할 초안'}</small></div>{canEdit&&!draft&&<button onClick={()=>setDraft(structuredClone(plan))}>수업 수정</button>}</header>
 <fieldset disabled={saving} className="cycle-exercises">{session.items.map((item,index)=><div className="cycle-exercise" key={`${session.number}-${index}`}>
 <h4>{index+1}. {item.exerciseName}</h4><strong className="cycle-prescription">{prescription(item)}</strong>
 <p>{(draft||plan.trainerEdited)&&<small>AI 제안 당시 이유 · </small>}{toFriendlyExplanation(item.reason)}</p>{item.recovery&&!/^새 제안[.\s]*$/.test(item.recovery)&&<p>{toFriendlyExplanation(item.recovery)}</p>}
 {draft&&<div className="cycle-item-editor"><label>운동<select value={item.id} onChange={e=>{const next=candidates.find(c=>c.id===e.target.value);if(next)updateItem(index,structuredClone(next));}}>{candidates.filter(c=>c.id===item.id||!session.items.some(i=>i.id===c.id)).map(c=><option key={c.id} value={c.id}>{c.exerciseName}</option>)}</select></label>
 {item.segments.map((segment,row)=><div className="cycle-set-editor" key={row}><span>{row+1}{item.measurementType==='repetitions'?'세트':'구간'}</span>{Object.entries(segment).filter(([key,value])=>!(key==='reps'&&(item.measurementType!=='repetitions'||segment.leftReps!==undefined))&&!(key==='kg'&&item.loadType!=='weighted'&&item.loadType!=='mixed')&&(value!==null||key==='kg')).map(([key,value])=><label key={key}>{labels[key]??key}<input aria-label={`${item.exerciseName} ${row+1}세트 ${labels[key]??key}`} type="number" step={['reps','leftReps','rightReps'].includes(key)?1:'any'} value={value??''} placeholder={key==='kg'&&item.loadType==='mixed'?'맨몸':undefined} onChange={e=>setValue(index,row,key,e.target.value)}/></label>)}<button type="button" disabled={item.segments.length<=1} onClick={()=>updateItem(index,{...item,segments:item.segments.filter((_,i)=>i!==row)})}>삭제</button></div>)}<button type="button" disabled={item.segments.length>=8} onClick={()=>updateItem(index,{...item,segments:[...item.segments,{...item.segments.at(-1)!}]})}>세트·구간 추가</button></div>}
 <details className="cycle-evidence"><summary>근거 기록 보기</summary><p>{item.referenceDate} · {item.reference}</p><button type="button" onClick={()=>onOriginal(item.id)}>원본 보기</button></details>
 </div>)}</fieldset>
 <section className="cycle-checks"><h4>이번 수업에서 확인할 것</h4><ul>{session.checks.map((c,i)=><li key={i}>{toFriendlyExplanation(c)}</li>)}</ul><p><strong>다음 진행</strong> {toFriendlyExplanation(session.progressWhen)}</p><p><strong>유지·조정</strong> {toFriendlyExplanation(session.adjustWhen)}</p></section>
 {draft&&<div className="journey-actions"><button disabled={saving} onClick={()=>{setDraft(null);setError('');}}>수정 취소</button><button className="primary" disabled={saving||!valid} onClick={()=>void save()}>{saving?'저장 중':'수정한 계획 저장'}</button></div>}{draft&&!valid&&<p role="alert">각 세트의 중량·횟수·단위를 확인해주세요.</p>}{error&&<p role="alert">{error}</p>}
 </article></section>;
}
