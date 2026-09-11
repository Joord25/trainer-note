"use client";
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {Icon} from './icons';
import {aiMessage,callAi,listenChats,serverAiEnabled,type ChatMessage} from '../lib/server-ai';
export type SourceSelection={fileId:string;fileName:string;page:number;rect:{x:number;y:number;width:number;height:number};image:string};
export function AssistantChat({memberId,online,selection,onClearSelection,onSelectArea,onClose,onEvidence,onOriginal}:{memberId:string;online:boolean;selection:SourceSelection|null;onClearSelection:()=>void;onSelectArea:()=>void;onClose:()=>void;onEvidence:(id:string)=>void;onOriginal:(fileId:string,page:number)=>void}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const end=useRef<HTMLDivElement>(null),alive=useRef(true),lock=useRef(false),retry=useRef<{id:string;payload:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!serverAiEnabled)return;return listenChats(memberId,setMessages,e=>setError(aiMessage(e)));},[memberId]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages.length,messages.at(-1)?.status]);
 async function send(e:FormEvent){e.preventDefault();if(lock.current||!online||!serverAiEnabled||!question.trim())return;lock.current=true;setBusy(true);setError('');
  const payload={question:question.trim(),fileId:selection?.fileId??'',previousId:[...messages].reverse().find(m=>m.status==='ready')?.id??'',...(selection?{selection:{page:selection.page,rect:selection.rect,image:selection.image}}:{})},encoded=JSON.stringify(payload);
  const id=retry.current?.payload===encoded?retry.current.id:crypto.randomUUID();retry.current={id,payload:encoded};
  try{await callAi({action:'chat',memberId,requestId:id,...payload});if(alive.current){setQuestion('');onClearSelection();retry.current=null;}}
  catch(e){if(alive.current)setError(aiMessage(e));}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <aside className="assistant-panel" aria-label="AI 도우미">
  <header className="assistant-heading"><span><Icon name="spark" size={17}/> AI 도우미</span><button className="icon-button" aria-label="AI 도우미 닫기" onClick={onClose}><Icon name="close" size={18}/></button></header>
  <div className="assistant-messages" aria-label="일지 질문과 답변">
   {!messages.length&&<div className="assistant-welcome"><span className="assistant-mark"><Icon name="spark" size={26}/></span><h3>일지에 대해 물어보세요</h3>{['최근 기록에서 달라진 점은?','다음 수업을 이렇게 추천한 이유는?'].map(q=><button key={q} onClick={()=>setQuestion(q)}>{q}</button>)}</div>}
   {messages.map(m=><article key={m.id} className="assistant-turn"><div className="assistant-question">{m.selection&&<button onClick={()=>onOriginal(m.fileId,m.selection!.page)}>선택한 원본 · {m.selection.page}쪽 ↗</button>}<p>{m.question}</p></div><div className="assistant-answer">{m.status==='processing'?<p role="status">일지를 살펴보고 있어요…</p>:m.status==='error'?<p className="file-error">{m.error}</p>:<><p>{m.answer}</p><div className="assistant-evidence">{m.references?.map((id,i)=><button key={id} onClick={()=>onEvidence(id)}>근거 {i+1} ↗</button>)}</div>{m.questions?.map(q=><button className="assistant-followup" key={q} onClick={()=>setQuestion(q)}>{q}</button>)}</>}</div></article>)}<div ref={end}/>
  </div>
  <button className="assistant-capture-card" onClick={onSelectArea} disabled={busy}><span className="capture-card-icon"><Icon name="select-area" size={23}/></span><span><strong>영역 선택해서 질문</strong><small>원본에서 드래그</small></span><Icon name="chevron" size={16}/></button>
  <form className="assistant-compose" onSubmit={e=>void send(e)}>
   {selection&&<div className="assistant-selection"><img src={selection.image} alt="질문할 원본 선택 영역"/><span>{selection.fileName}<small>{selection.page}쪽 · 선택 영역</small></span><button type="button" className="icon-button" aria-label="선택 영역 해제" onClick={onClearSelection}>×</button></div>}
   <textarea aria-label="일지에 질문" placeholder={selection?'선택한 부분에 대해 질문하세요':'일지에 대해 무엇이든 물어보세요'} maxLength={1200} rows={3} value={question} onChange={e=>{setQuestion(e.target.value);retry.current=null;}} disabled={busy}/>
   <div className="assistant-compose-actions"><button type="button" onClick={onSelectArea} disabled={busy} aria-label="원본 영역 선택" title="원본 영역 선택"><Icon name="select-area" size={19}/></button><button className="primary" aria-label="질문 보내기" disabled={busy||!question.trim()||!online||!serverAiEnabled}>{busy?'답변 중…':'보내기'} <Icon name="arrow" size={14}/></button></div>
   {!serverAiEnabled&&<p className="file-error">AI 서버 연결 후 질문할 수 있어요.</p>}
   {error&&<p className="file-error" role="alert">{error}<button type="button" onClick={()=>{retry.current=null;setError('');}}>새 요청으로 다시 준비</button></p>}
   <small>답변은 검토용이에요. 기록과 수업 계획은 직접 반영해주세요.</small>
  </form>
 </aside>;
}
