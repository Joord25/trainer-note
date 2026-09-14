"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {callAi,aiMessage} from '../lib/server-ai';
import type {SessionNote} from '../lib/session-notes';
export function SessionNoteEditor({memberId,date,note,online,onDirty,onBeforeSave}:{memberId:string;date:string;note?:SessionNote;online:boolean;onDirty:(dirty:boolean)=>void;onBeforeSave:()=>boolean}){
 const inputId=useId();
 const [text,setText]=useState(note?.text??''),[revision,setRevision]=useState(note?.revision??0),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const dirty=useRef(false),lock=useRef(false),notify=useRef(onDirty);notify.current=onDirty;
 useEffect(()=>{if(!dirty.current){setText(note?.text??'');setRevision(note?.revision??0);}},[note?.text,note?.revision]);
 useEffect(()=>()=>notify.current(false),[]);
 useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{if(dirty.current){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[]);
 function edit(value:string){setText(value);dirty.current=value!==(note?.text??'');onDirty(dirty.current);setMessage('');setError('');}
 async function save(){if(lock.current||!online||!onBeforeSave())return;lock.current=true;setBusy(true);setError('');try{const result=await callAi({action:'sessionNote',memberId,date,text,revision}) as {revision:number;refreshQueued:boolean};dirty.current=false;onDirty(false);setRevision(result.revision);setText(text.trim());setMessage(result.refreshQueued?'저장됨':'저장됨 · AI 분석 갱신 다시 시도 필요');}catch(e){setError(aiMessage(e));}finally{lock.current=false;setBusy(false);}}
 return <section className="page-session-note" aria-label={`${date} 수업 메모`}><div className="page-session-note-heading"><label htmlFor={inputId}>수업 메모 <small>{date.slice(5).replace('-','.')}</small></label></div><textarea id={inputId} aria-label={`${date} 수업 메모`} rows={2} maxLength={1000} disabled={busy||!online} value={text} placeholder="예: 수면 부족으로 피로 호소. 오늘 전체 운동량 조절." onChange={e=>edit(e.target.value)}/><div className="page-session-note-actions">{message&&<small role="status">{message}</small>}{error&&<p className="file-error" role="alert">{error}</p>}{dirty.current&&<button disabled={busy} onClick={()=>{dirty.current=false;onDirty(false);setText(note?.text??'');setRevision(note?.revision??0);setError('');}}>취소</button>}<button disabled={busy||!online||!dirty.current} onClick={()=>void save()}>{busy?'저장 중…':'메모 저장'}</button></div></section>;
}
