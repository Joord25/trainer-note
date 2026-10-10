"use client";
import {useEffect,useId,useRef,useState} from 'react';
import type {ChatMessage} from '../lib/server-ai';
import {Icon} from './icons';
export function AnswerSave({message}:{message:ChatMessage}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),lock=useRef(false);
 const [busy,setBusy]=useState(false),[open,setOpen]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(false);
 useEffect(()=>{if(!notice||error)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);},[notice,error]);
 function position(){const r=trigger.current?.getBoundingClientRect(),el=menu.current;if(!r||!el)return;el.style.left=Math.max(8,Math.min(r.left,innerWidth-192))+'px';el.style.top=Math.max(8,Math.min(r.bottom+6,innerHeight-112))+'px';}
 function close(){menu.current?.hidePopover();trigger.current?.focus({preventScroll:true});}
 async function save(format:'pdf'|'png'){
  if(lock.current)return;const body=trigger.current?.closest('.assistant-answer')?.querySelector<HTMLElement>('.assistant-answer-body');if(!body){setNotice('저장할 답변을 찾지 못했어요.');setError(true);return;}
  lock.current=true;setBusy(true);setNotice('');setError(false);close();
  try{const {saveAnswer}=await import('../lib/answer-export');await saveAnswer(body,message,format);setNotice(format==='pdf'?'인쇄 창에서 PDF로 저장을 선택해주세요.':'이 답변을 PNG로 저장했어요.');}
  catch(e){setError(true);setNotice(e instanceof Error?e.message:'저장하지 못했어요. 다시 시도해주세요.');}
  finally{lock.current=false;setBusy(false);}
 }
 return <span className="answer-save"><button ref={trigger} type="button" popoverTarget={id} aria-label="이 답변 저장" aria-expanded={open} disabled={busy} onClick={position} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();position();menu.current?.showPopover();menu.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}><Icon name="download" size={15}/>{busy?'저장 중…':'저장'}</button><div id={id} ref={menu} popover="auto" className="answer-save-menu" role="group" aria-label="답변 저장 형식" onToggle={e=>setOpen(e.newState==='open')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();close();}}}><button type="button" onClick={()=>void save('pdf')}>PDF로 저장</button><button type="button" onClick={()=>void save('png')}>PNG로 저장</button></div>{notice&&<span className={error?'answer-save-notice file-error':'answer-save-notice'} role={error?'alert':'status'}>{notice}</span>}</span>;
}
