"use client";
import {useEffect,useRef,useState} from 'react';
import {callAi,aiMessage} from '../lib/server-ai';
import {AnswerText} from './assistant-answer';
import {GuidanceNote} from './guidance-note';
import type {GuidanceSource} from './direction-review';
export type DirectionSelection={directions:{id:string;text:string}[];version:string};
type Row={id:string;mode:'discuss'|'draft';question:string;answer:string;references:GuidanceSource[];directions:{id:string;text:string}[];basedOnDirections:{id:string;text:string}[]};
type Conversation={revision:number;messages:Row[];processing:boolean;notice:string};
const empty:Conversation={revision:0,messages:[],processing:false,notice:''};
export function DirectionConversation({request=callAi,memberId,inputKey,discussionKey,online,directions,onApply}:{request?:typeof callAi;memberId:string;inputKey:string;discussionKey:string;online:boolean;directions:{id:string;text:string}[];onApply:(directions:{id:string;text:string}[])=>Promise<void>}){
 const [state,setState]=useState<Conversation>(empty),[question,setQuestion]=useState(''),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[applied,setApplied]=useState(''),[refresh,setRefresh]=useState(0);
 const live=useRef(true),lock=useRef(false),retry=useRef<{key:string;id:string}|null>(null),input=useRef<HTMLTextAreaElement>(null),dialogue=useRef<HTMLDivElement>(null);
 useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
 useEffect(()=>{if(!online)return;let active=true;void request({action:'directionConversation',memberId,inputKey,discussionKey}).then(v=>{if(active){setState(v as unknown as Conversation);setLoaded(true);setError('');}}).catch(e=>{if(active)setError(aiMessage(e));});return()=>{active=false;};},[online,memberId,inputKey,discussionKey,request,refresh]);
 useEffect(()=>{if(!online||!state.processing)return;let active=true;const timer=setTimeout(()=>{void request({action:'directionConversation',memberId,inputKey,discussionKey}).then(v=>{if(active)setState(v as unknown as Conversation);}).catch(e=>{if(active)setError(aiMessage(e));});},3000);return()=>{active=false;clearTimeout(timer);};},[state,online,memberId,inputKey,discussionKey,request]);
 useEffect(()=>{if(dialogue.current)dialogue.current.scrollTop=dialogue.current.scrollHeight;},[state.messages.length]);
 const blocked=!online||!loaded||busy||state.processing;
 async function send(mode:'discuss'|'draft'){
  if(blocked||lock.current||mode==='discuss'&&!question.trim())return;
  const text=mode==='draft'?'지금까지의 대화와 현재 방향 목록을 바탕으로 다음 수업에 반영할 방향 초안을 정리해주세요.':question.trim();
  const payload={mode,question:text,directions:directions.filter(d=>d.text.trim()),revision:state.revision};
  const key=JSON.stringify(payload);if(retry.current?.key!==key)retry.current={key,id:crypto.randomUUID()};
  lock.current=true;setBusy(true);setError('');
  try{const v=await request({action:'converseDirection',memberId,inputKey,discussionKey,requestId:retry.current.id,...payload});if(!live.current)return;setState(v as unknown as Conversation);if(mode==='discuss')setQuestion('');retry.current=null;}
  catch(e){if(live.current)setError(aiMessage(e));}finally{lock.current=false;if(live.current)setBusy(false);}
 }
 async function apply(row:Row){if(blocked||lock.current)return;lock.current=true;setBusy(true);setError('');try{await onApply(row.directions);if(live.current)setApplied(row.id);}catch(e){if(live.current)setError(aiMessage(e));}finally{lock.current=false;if(live.current)setBusy(false);}}
 const latest=state.messages.at(-1),draft=latest?.mode==='draft'&&latest.directions.length?latest:null;
 // A returned draft cannot overwrite edits made while it was being generated or since it was reviewed.
 const draftChanged=!!draft&&JSON.stringify(draft.basedOnDirections)!==JSON.stringify(directions.filter(d=>d.text.trim()));
 return <section className="direction-conversation" aria-label="분석을 함께 살펴보기">
  <div className="direction-opening"><span className="direction-ai-mark" aria-hidden="true">AI</span><p>위 분석에서 실제 지도 의도와 다르게 읽힌 부분이 있나요? 지금 구성을 선택한 이유나 고민을 알려주시면, 회원 목표와 기록을 함께 보며 다음 방향을 정리할게요.</p></div>
  {!!state.messages.length&&<div ref={dialogue} className="direction-dialogue" aria-label="이 분석의 대화 기록">{state.messages.map((m,i)=><div className="direction-exchange" key={m.id}>{i<state.messages.length-2?<details><summary>{m.mode==='draft'?'방향 초안 정리':m.question}</summary><div className="direction-reply"><AnswerText text={m.answer}/></div>{!!m.references.length&&<GuidanceNote sources={m.references}/>}</details>:<><p className="direction-question"><small>트레이너</small>{m.question}</p><div className="direction-reply"><small>AI 코칭 의견</small><AnswerText text={m.answer}/>{!!m.references.length&&<GuidanceNote sources={m.references}/>}</div></>}</div>)}</div>}
  {(busy||state.processing)&&<p role="status">{busy?'목표와 기록을 함께 검토하고 있어요…':'앞선 답변을 불러오고 있어요…'}</p>}
  <form className="direction-composer" onSubmit={e=>{e.preventDefault();void send('discuss');}}><label htmlFor="direction-question">지도 의도나 의견을 들려주세요</label><textarea ref={input} id="direction-question" rows={3} maxLength={2000} disabled={blocked} value={question} placeholder="예: 하체 위주로 진행한 건 기초 근력을 먼저 다지려는 의도였어요. 가슴 운동은 어떻게 가져가면 좋을까요?" onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send('discuss');}}}/><div><small>대화는 자동 저장 · 수업 방향은 확인 후 반영</small><button className="primary" disabled={blocked||!question.trim()} type="submit">의견 보내기 ↑</button></div></form>
  {(error||state.notice)&&<p role="alert">{error||state.notice} <button onClick={()=>setRefresh(v=>v+1)} disabled={busy}>대화 다시 불러오기</button></p>}
  {!!state.messages.length&&<div className="direction-draft-action"><button disabled={blocked||!!question.trim()} onClick={()=>void send('draft')}>대화 내용으로 방향 업데이트</button><small>{question.trim()?'작성 중인 의견을 먼저 보내주세요.':'전체 분석을 다시 실행하지 않고, 아래 방향 목록의 변경안을 제안해요.'}</small></div>}
  {draft&&applied===draft.id?<p className="direction-applied" role="status">✓ 아래 방향 목록에 반영했어요. 필요한 내용은 직접 수정할 수 있어요.</p>:draft&&<section className="direction-draft-preview" aria-label="수업 방향 변경안"><h4>이렇게 정리하면 어떨까요?</h4><ol>{draft.directions.map(d=><li key={d.id}>{d.text}</li>)}</ol>{applied===draft.id?<p role="status">아래 방향 목록에 반영했어요. 직접 수정한 뒤 수업 계획으로 이어갈 수 있어요.</p>:<><p>아래 방향 목록 전체를 이 내용으로 바꿉니다. 아직 수업 계획에는 저장되지 않았어요.</p>{draftChanged&&<p role="status">초안을 만든 뒤 방향을 직접 수정했어요. 수정한 내용으로 다시 업데이트해주세요.</p>}<button className="primary" disabled={blocked||draftChanged} onClick={()=>void apply(draft)}>확인한 내용으로 목록에 반영</button></>}</section>}
 </section>;
}
