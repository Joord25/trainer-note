"use client";
import {useEffect,useRef} from 'react';
export function NewChatDialog({busy,error,onCancel,onConfirm}:{busy:boolean;error:string;onCancel:()=>void;onConfirm:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
 return <dialog ref={dialog} className="new-chat-dialog" aria-labelledby="new-chat-title" onCancel={e=>{e.preventDefault();if(!busy)onCancel();}}><h2 id="new-chat-title">새 채팅을 시작할까요?</h2><p>현재 대화는 대화 기록에 보관돼요.<br/>원본, 운동 기록과 진행 분석은 그대로 유지돼요.</p>{error&&<p className="file-error" role="alert">{error}</p>}<div><button type="button" disabled={busy} onClick={onCancel} autoFocus>취소</button><button type="button" className="primary" disabled={busy} onClick={onConfirm}>{busy?'준비 중…':'새 채팅 시작'}</button></div></dialog>;
}
