"use client";
import {useEffect,useState,useRef} from 'react';
import {Icon} from './icons';
export function WorkspaceToast({message,onClose}:{message:string;onClose:()=>void}) {
 const [paused,setPaused]=useState(false),close=useRef(onClose);
 useEffect(()=>{close.current=onClose;},[onClose]);
 useEffect(()=>{if(!message||paused)return;const timer=setTimeout(()=>close.current(),7000);return()=>clearTimeout(timer);},[message,paused]);
 if(!message)return null;
 return <div className="workspace-toast" onMouseEnter={()=>setPaused(true)} onMouseLeave={()=>setPaused(false)} onFocus={()=>setPaused(true)} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node|null))setPaused(false);}}><span role="status">{message}</span><button type="button" className="icon-button" aria-label="알림 닫기" onClick={onClose}><Icon name="close" size={18}/></button></div>;
}
