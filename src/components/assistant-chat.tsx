"use client";
import {useEffect,useRef,useState,type FormEvent,type KeyboardEvent} from 'react';
import {AnswerActions,AnswerText,AnswerSources,AnswerRecords,type RecordReference} from './assistant-answer';
import {ChatCapture} from './chat-capture';
import {NewChatDialog} from './new-chat-dialog';
import {CapturePreview} from './capture-preview';
import {InterpretationRules} from './interpretation-rules';
import {Icon} from './icons';
import {useWorkspaceTextScale} from '../lib/workspace-text-scale';
import {aiMessage,callAi,listenChats,listenChatState,listenChatSessions,serverAiEnabled,type ChatState,type ChatSession,type ChatMessage} from '../lib/server-ai';
const activity={checking_search:'검색할 내용을 확인하고 있어요',searching_web:'웹 자료를 검색하고 있어요',searching_records:'관련 기록을 찾고 있어요',analyzing_capture:'캡처를 분석하고 있어요',analyzing_records:'운동 기록을 분석하고 있어요',thinking:'답변을 생각하고 있어요',composing:'답변을 정리하고 있어요',complete:'답변이 준비됐어요'};
export type AssistantDraft={id:string;fileId:string;fileName:string;page:number;question:string};
export type SourceSelection={kind?:'source'|'screen';fileId:string;fileName:string;page:number;rect:{x:number;y:number;width:number;height:number};image:string};
export function AssistantChat({memberId,online,selection,onRestoreSelection,onClearSelection,onSelectArea,onClose,onEvidence,onOriginal,draft,referenceRecords=[]}:{memberId:string;online:boolean;selection:SourceSelection|null;onRestoreSelection:(v:SourceSelection|null)=>void;onClearSelection:()=>void;onSelectArea:()=>void;onClose:()=>void;onEvidence:(id:string)=>void;onOriginal:(fileId:string,page:number)=>void;draft?:AssistantDraft|null;referenceRecords?:RecordReference[]}){
 const [textScale]=useWorkspaceTextScale(memberId);
 const [messages,setMessages]=useState<ChatMessage[]>([]),[question,setQuestion]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [chatState,setChatState]=useState<ChatState|null>(null),[sessions,setSessions]=useState<ChatSession[]>([]),[archived,setArchived]=useState<ChatSession|null>(null),[newChatOpen,setNewChatOpen]=useState(false),[newChatError,setNewChatError]=useState(''),[resetBusy,setResetBusy]=useState(false),[pending,setPending]=useState<{message:ChatMessage;image?:string}|null>(null);
 const newChatId=useRef(''),currentGeneration=chatState?.generation??0,generation=archived?.generation??currentGeneration;
 const drafts=useRef(new Map<number,{question:string;context:AssistantDraft|null;selection:SourceSelection|null}>());
 const [loadedGeneration,setLoadedGeneration]=useState<number|null>(null);
 const [context,setContext]=useState<AssistantDraft|null>(null),[preview,setPreview]=useState<SourceSelection|null>(null);
 useEffect(()=>{if(draft){setQuestion(draft.question);setContext(draft);}},[draft]);
 const input=useRef<HTMLTextAreaElement>(null),composing=useRef(false),historyMenu=useRef<HTMLDetailsElement>(null);
 useEffect(()=>{
  function outside(e:PointerEvent){const menu=historyMenu.current;if(menu?.open&&!menu.contains(e.target as Node))menu.removeAttribute('open');}
  function escape(e:globalThis.KeyboardEvent){const menu=historyMenu.current;if(e.key==='Escape'&&menu?.open){menu.removeAttribute('open');menu.querySelector('summary')?.focus();}}
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[]);
 useEffect(()=>{if(selection)input.current?.focus();},[selection]);
 const end=useRef<HTMLDivElement>(null),alive=useRef(true),lock=useRef(false),retry=useRef<{id:string;payload:string}|null>(null);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{if(!serverAiEnabled)return;const fail=(e:unknown)=>setError(aiMessage(e));const off=[listenChatState(memberId,setChatState,fail),listenChatSessions(memberId,setSessions,fail)];return()=>off.forEach(f=>f());},[memberId]);
 const legacyEndAt=sessions.find(s=>s.generation===0)?.legacyEndAt??sessions.find(s=>s.generation===0)?.endAt;
 useEffect(()=>{if(!serverAiEnabled||!chatState)return;let active=true;setMessages([]);setLoadedGeneration(null);const off=listenChats(memberId,v=>{if(active){setMessages(v);setLoadedGeneration(generation);}},e=>{if(active)setError(aiMessage(e));},generation,legacyEndAt);return()=>{active=false;off();};},[memberId,!!chatState,generation,legacyEndAt]);
 const lastGeneration=useRef<number|null>(null);
 useEffect(()=>{if(!chatState)return;if(lastGeneration.current!==null&&lastGeneration.current!==currentGeneration&&!archived){setQuestion('');setContext(null);setPreview(null);setPending(null);setError('');retry.current=null;onClearSelection();}lastGeneration.current=currentGeneration;},[chatState,currentGeneration,archived,onClearSelection]);
 const shown=messages.filter(m=>(m.generation??0)===generation);
 const turns=pending&&pending.message.generation===generation&&!shown.some(m=>m.id===pending.message.id)?[...shown,pending.message]:shown;
 const waiting=busy||shown.some(m=>m.status==='processing'),blocked=waiting||resetBusy||!chatState||loadedGeneration!==generation;
 function openConversation(session:ChatSession|null){
  if(lock.current||waiting||resetBusy)return;
  const next=session?.generation??currentGeneration;if(next===generation)return;
  drafts.current.set(generation,{question,context,selection});
  const saved=drafts.current.get(next);setQuestion(saved?.question??'');setContext(saved?.context??null);onRestoreSelection(saved?.selection??null);
  setArchived(session);setMessages([]);setLoadedGeneration(null);setPending(null);setPreview(null);setError('');retry.current=null;
 }

 async function startNewChat(){if(lock.current||resetBusy||!online||!chatState)return;setResetBusy(true);setNewChatError('');try{const result=await callAi({action:'newChat',memberId,chatGeneration:currentGeneration,requestId:newChatId.current}) as {generation?:number};drafts.current.set(generation,{question,context,selection});const saved=archived&&result.generation===currentGeneration?drafts.current.get(currentGeneration):undefined;setQuestion(saved?.question??'');setContext(saved?.context??null);setPending(null);setPreview(null);setError('');retry.current=null;onRestoreSelection(saved?.selection??null);setArchived(null);setNewChatOpen(false);}catch(e){setNewChatError(aiMessage(e));}finally{setResetBusy(false);}}

 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'});},[messages.length,messages.at(-1)?.status]);
 function composerKey(e:KeyboardEvent<HTMLTextAreaElement>){
  if(e.key!=='Enter'||composing.current||e.nativeEvent.isComposing||e.keyCode===229)return;
  if(e.altKey){
   e.preventDefault();if(blocked)return;
   const field=e.currentTarget,start=field.selectionStart,end=field.selectionEnd;
   const value=question.slice(0,start)+'\n'+question.slice(end);
   if(value.length>1200)return;
   setQuestion(value);retry.current=null;
   requestAnimationFrame(()=>{if(field.isConnected)field.setSelectionRange(start+1,start+1);});
  }else if(!e.shiftKey&&!e.ctrlKey&&!e.metaKey){e.preventDefault();if(!e.repeat)e.currentTarget.form?.requestSubmit();}
 }
 async function send(e:FormEvent){e.preventDefault();if(lock.current||blocked||!online||!serverAiEnabled||!question.trim())return;lock.current=true;setBusy(true);setError('');
  const payload={chatGeneration:generation,resumeConversation:!!archived,question:question.trim(),fileId:selection?.fileId??context?.fileId??'',previousId:[...shown].reverse().find(m=>m.status==='ready')?.id??'',...(selection?{selection:{kind:selection.kind??'source',page:selection.page,rect:selection.rect,image:selection.image}}:{})},encoded=JSON.stringify(payload);
  const id=retry.current?.payload===encoded?retry.current.id:crypto.randomUUID();retry.current={id,payload:encoded};
  setPending({message:{id,generation,question:payload.question,fileId:payload.fileId,previousId:payload.previousId,status:'processing',phase:'thinking',selection:selection?{kind:selection.kind,page:selection.page,rect:selection.rect}:undefined,captureAvailable:!!selection},image:selection?.image});
  try{await callAi({action:'chat',memberId,requestId:id,...payload});if(alive.current){drafts.current.delete(generation);setQuestion('');setContext(null);onClearSelection();retry.current=null;}}
  catch(e){if(alive.current)setError(aiMessage(e));}finally{lock.current=false;if(alive.current){setBusy(false);setPending(null);}}
 }
 async function regenerate(message:ChatMessage){
  if(lock.current||blocked||!online||!serverAiEnabled)return;
  lock.current=true;setBusy(true);setError('');
  try{await callAi({action:'regenerateChat',memberId,messageId:message.id,chatGeneration:generation,resumeConversation:!!archived,revision:message.revision??0,regenerationId:crypto.randomUUID()});}
  catch(e){if(alive.current)setError(aiMessage(e));}finally{lock.current=false;if(alive.current)setBusy(false);}
 }
 return <aside className="assistant-panel" aria-label="AI 도우미">
  <header className="assistant-heading"><span><Icon name="spark" size={17}/> AI 도우미</span><button className="icon-button" aria-label="AI 도우미 닫기" onClick={onClose}><Icon name="close" size={18}/></button></header>
  <div className="assistant-conversation-tools" aria-label="대화 관리">
   {sessions.length?<details ref={historyMenu} className="assistant-history"><summary><Icon name="clock" size={15}/> 대화 기록</summary><div>{sessions.map(session=><button key={session.id} aria-label={session.title} aria-current={session.generation===generation?"page":undefined} disabled={waiting||resetBusy} onClick={e=>{openConversation(session);e.currentTarget.closest('details')?.removeAttribute('open');}}><span>{session.title}</span><small>{session.endAt.toDate().toLocaleDateString('ko-KR')}</small></button>)}</div></details>:<button type="button" className="assistant-history-empty" disabled title="저장된 대화가 아직 없어요"><Icon name="clock" size={15}/> 대화 기록</button>}
   <button type="button" className="assistant-new-chat" disabled={blocked||!online||!serverAiEnabled} onClick={()=>{historyMenu.current?.removeAttribute('open');newChatId.current=crypto.randomUUID();setNewChatError('');setNewChatOpen(true);}}><Icon name="plus" size={15}/>새 채팅</button>
  </div>
  {archived&&<div className="assistant-history-banner"><span>지난 대화에 이어서 질문</span><button disabled={waiting||resetBusy} onClick={()=>openConversation(null)}>현재 채팅으로 돌아가기 <Icon name="arrow" size={13}/></button></div>}
  <div className="assistant-messages" style={{zoom:textScale/100}} aria-label="일지 질문과 답변">{serverAiEnabled&&<InterpretationRules memberId={memberId} online={online}/>}
   {!archived&&!turns.length&&<div className="assistant-welcome"><h3>이 기록에 대해 무엇이든 물어보세요</h3><div className="assistant-suggestions">{['최근 변화 3가지만 정리해줘','다음 수업에서 확인할 점은?','이 운동 기록을 쉽게 설명해줘'].map(q=><button key={q} onClick={()=>{setQuestion(q);input.current?.focus();}}>{q}</button>)}</div></div>}
   {turns.map(m=><article key={m.id} className="assistant-turn"><div className="assistant-question">{m.captureAvailable?<ChatCapture memberId={memberId} messageId={m.id} localImage={pending?.message.id===m.id?pending.image:undefined} onPreview={image=>setPreview({kind:'screen',fileId:m.fileId,fileName:'화면 캡처',page:m.selection?.page??0,rect:m.selection?.rect??{x:0,y:0,width:1,height:1},image})}/>:m.selection&&(m.selection.kind==='screen'?<span className="assistant-capture-label"><Icon name="select-area" size={14}/> 화면 캡처</span>:<button onClick={()=>onOriginal(m.fileId,m.selection!.page)}>선택한 원본 · {m.selection.page}쪽 ↗</button>)}<p>{m.question}</p></div><div className="assistant-answer">{m.status==='processing'?<div className="assistant-thinking" role="status" aria-live="polite"><span className="assistant-thinking-icon"><Icon name={m.phase==='searching_web'||m.phase==='searching_records'?'search':'spark'} size={20}/></span><span>{activity[m.phase??'thinking']}<span className="thinking-dots" aria-hidden="true"><i/><i/><i/></span></span></div>:m.status==='error'?<p className="file-error">{m.error}</p>:<><AnswerText text={m.answer??''} sources={m.webSources}/><AnswerSources sources={m.webSources} suggestions={m.searchSuggestions}/>{m.searchNotice&&<p className="assistant-search-notice" role="status">{m.searchNotice}</p>}<AnswerRecords scope={m.contextScope} ids={m.references} records={referenceRecords} saved={m.referenceDetails} onOpen={onEvidence}/>{m.questions?.map(q=><button className="assistant-followup" disabled={blocked} key={q} onClick={()=>setQuestion(q)}>{q}</button>)}<AnswerActions message={m} disabled={blocked||!online||!serverAiEnabled} canRegenerate={true} onRegenerate={()=>void regenerate(m)}/>{m.regenerationError&&<p className="file-error">다시 생성하지 못했어요. 기존 답변은 유지했어요. {m.regenerationError}</p>}</>}</div></article>)}<div ref={end}/>
  </div>
  {!archived&&!selection&&!turns.length&&<button className="assistant-capture-card" style={{zoom:textScale/100}} onClick={onSelectArea} disabled={blocked}><span className="capture-card-icon"><Icon name="select-area" size={23}/></span><span><strong>화면을 캡처해서 질문</strong><small>원하는 부분을 드래그하세요</small></span><Icon name="chevron" size={16}/></button>}
  {<form className="assistant-compose" style={{zoom:textScale/100}} onSubmit={e=>void send(e)}>
   {context&&!selection&&<div className="assistant-selection"><button type="button" onClick={()=>onOriginal(context.fileId,context.page)}>{context.fileName} · {context.page}쪽</button><button type="button" aria-label="질문할 기록 해제" onClick={()=>setContext(null)}>×</button></div>}
   {selection&&<div className="assistant-selection"><button type="button" className="assistant-capture-preview" aria-label="첨부 캡처 크게 보기" title="크게 보기" onClick={()=>setPreview(selection)}><img src={selection.image} alt="질문에 첨부할 캡처"/><span>{selection.fileName}<small>{selection.kind==='screen'?'선택한 화면 영역':`${selection.page}쪽 · 선택 영역`}</small></span></button><button type="button" className="icon-button" aria-label="선택 영역 해제" onClick={onClearSelection}>×</button></div>}
   <textarea ref={input} aria-label="일지에 질문" title="Enter로 보내기 · Alt+Enter로 줄바꿈" onKeyDown={composerKey} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} placeholder={selection?'선택한 부분에 대해 질문하세요':'AI 도우미에게 물어보세요'} maxLength={1200} rows={3} value={question} onChange={e=>{setQuestion(e.target.value);retry.current=null;}} disabled={blocked}/>
   <div className="assistant-compose-actions"><button type="button" onClick={onSelectArea} disabled={blocked} aria-label="화면 영역 캡처" title="화면 영역 캡처"><Icon name="select-area" size={19}/></button><button className="primary" aria-label="질문 보내기" disabled={blocked||!question.trim()||!online||!serverAiEnabled}><Icon name={busy?'clock':'arrow'} size={19}/></button></div>
   {!serverAiEnabled&&<p className="file-error">AI 서버 연결 후 질문할 수 있어요.</p>}
   {error&&<p className="file-error" role="alert">{error}<button type="button" onClick={()=>{retry.current=null;setError('');}}>새 요청으로 다시 준비</button></p>}

  </form>}
 {newChatOpen&&<NewChatDialog busy={resetBusy} error={newChatError} onCancel={()=>setNewChatOpen(false)} onConfirm={()=>void startNewChat()}/>}
 {preview&&<CapturePreview image={preview.image} title={preview.fileName} onClose={()=>setPreview(null)}/>}
 </aside>;
}
