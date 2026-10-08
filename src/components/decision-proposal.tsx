"use client";
import {useState} from 'react';
import {aiMessage,callAi,decisionChoiceLabels,type ChatMessage,type DecisionChoice} from '../lib/server-ai';

/** A decision the assistant proposes in discussion mode. Nothing is saved until the trainer applies it. */
export function DecisionProposalCard({message,memberId,disabled,onSaved}:{message:ChatMessage;memberId:string;disabled:boolean;onSaved?:()=>void}){
 const p=message.decisionProposal!,target=message.discussion;
 const [editing,setEditing]=useState(false),[dismissed,setDismissed]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [choice,setChoice]=useState<DecisionChoice>(p.choice),[reason,setReason]=useState(p.reason);
 const [text,setText]=useState(p.patch?.text??''),[actionReason,setActionReason]=useState(p.patch?.reason??''),[check,setCheck]=useState(p.patch?.check??'');
 const [remember,setRemember]=useState(false),[principle,setPrinciple]=useState('');
 const applied=!!message.decisionApplied;
 const withPatch=p.target.kind==='direction'&&choice==='adjust';
 const invalid=!reason.trim()||withPatch&&!text.trim()||remember&&!principle.trim();
 async function save(useEdits:boolean){
  if(busy||!target)return;setBusy(true);setError('');
  const c=useEdits?choice:p.choice,patch=useEdits?(withPatch?{text:text.trim(),reason:actionReason.trim(),check:check.trim()}:null):p.patch;
  try{await callAi({action:'saveCoachingDecision',memberId,inputKey:target.inputKey,fingerprint:target.fingerprint,target:{kind:p.target.kind,id:p.target.id},choice:c,reason:(useEdits?reason:p.reason).trim(),patch,remember:useEdits&&remember,principle:useEdits&&remember?principle.trim():'',chatId:message.id});setEditing(false);onSaved?.();}
  catch(e){setError(aiMessage(e));}finally{setBusy(false);}
 }
 return <section className="decision-proposal" aria-label="결정 제안">
  <header><small>결정 제안 · {p.target.label}</small><strong>{decisionChoiceLabels[p.choice]}</strong></header>
  <p>{p.reason}</p>
  {p.patch&&<div className="decision-patch"><small>바뀌는 다음 수업 제안</small><p>{p.patch.text}</p>{p.patch.check&&<p><small>실행·확인 조건</small> {p.patch.check}</p>}</div>}
  {applied?<p className="decision-state" role="status">반영했어요. 다음 수업의 방향에 표시됩니다.</p>
  :dismissed?<p className="decision-state">넘겼어요. 저장된 내용은 없어요. <button type="button" onClick={()=>setDismissed(false)}>다시 보기</button></p>
  :editing?<div className="decision-edit">
    <label>결정<select value={choice} disabled={busy} onChange={e=>setChoice(e.target.value as DecisionChoice)}>{(Object.keys(decisionChoiceLabels) as DecisionChoice[]).map(k=><option key={k} value={k}>{decisionChoiceLabels[k]}</option>)}</select></label>
    <label>이유<textarea maxLength={300} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
    {withPatch&&<><label>바뀐 다음 수업 제안<textarea maxLength={400} value={text} disabled={busy} onChange={e=>setText(e.target.value)}/></label><label>이 회원에게 필요한 이유 <small>선택</small><textarea maxLength={300} value={actionReason} disabled={busy} onChange={e=>setActionReason(e.target.value)}/></label><label>실행·확인 조건 <small>선택</small><textarea maxLength={300} value={check} disabled={busy} placeholder="확인 결과 A이면 …, B이면 …" onChange={e=>setCheck(e.target.value)}/></label></>}
    <label className="decision-remember"><input type="checkbox" checked={remember} disabled={busy} onChange={e=>setRemember(e.target.checked)}/>다른 회원에도 참고할 기준으로 저장</label>
    {remember&&<label>참고 기준<textarea maxLength={500} value={principle} disabled={busy} placeholder="예: 자세 교정 목적의 등 위주 구성은 가슴 비중이 낮아도 유지한다" onChange={e=>setPrinciple(e.target.value)}/></label>}
    <div className="decision-actions"><button type="button" disabled={busy} onClick={()=>setEditing(false)}>취소</button><button type="button" className="primary" disabled={busy||disabled||invalid} onClick={()=>void save(true)}>{busy?'저장 중…':'수정한 내용으로 반영'}</button></div>
   </div>
  :<div className="decision-actions"><button type="button" disabled={busy} onClick={()=>setDismissed(true)}>넘기기</button><button type="button" disabled={busy||disabled} onClick={()=>setEditing(true)}>수정 후 반영</button><button type="button" className="primary" disabled={busy||disabled} onClick={()=>void save(false)}>{busy?'저장 중…':'반영'}</button></div>}
  {error&&<p className="file-error" role="alert">{error}</p>}
 </section>;
}
