"use client";
import {useEffect,useState} from 'react';
import {callAi,aiMessage,listenInterpretations,type Interpretation} from '../lib/server-ai';
export function InterpretationRules({memberId,online}:{memberId:string;online:boolean}){
 const [rules,setRules]=useState<Interpretation[]>([]),[edit,setEdit]=useState<Interpretation|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>listenInterpretations(setRules,e=>setError(aiMessage(e))),[]);
 async function save(rule:Interpretation,remove=false){if(busy||!online)return;setBusy(true);setError('');try{await callAi({action:'interpretation',memberId,id:rule.id,revision:rule.revision,explanation:rule.explanation,remove});setEdit(null);}catch(e){setError(aiMessage(e));}finally{setBusy(false);}}
 if(!rules.length&&!error)return null;
 return <details className="interpretation-rules"><summary>저장한 표기 해석 · {rules.length}</summary>{!rules.length&&<p>기록 수정에서 ‘다음 판독에도 참고’를 선택하면 여기에 저장돼요.</p>}<ul>{rules.map(r=><li key={r.id}><strong>{r.alias} · {r.exerciseName}</strong>{edit?.id===r.id?<><textarea aria-label="표기 해석 수정" maxLength={1000} value={edit.explanation} onChange={e=>setEdit({...edit,explanation:e.target.value})}/><button disabled={busy||!online||!edit.explanation.trim()} onClick={()=>void save(edit)}>저장</button><button disabled={busy} onClick={()=>setEdit(null)}>취소</button></>:<><p>{r.explanation}</p><button disabled={busy||!online} onClick={()=>setEdit(r)}>수정</button><button disabled={busy||!online} onClick={()=>void save(r,true)}>삭제</button></>}</li>)}</ul>{error&&<p className="file-error" role="alert">{error}</p>}</details>;
}
