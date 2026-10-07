"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';

export function AnalysisControlsMenu({active,onActivate,children}:{active:boolean;onActivate:()=>void;children:ReactNode}){
 const [open,setOpen]=useState(false),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),id=useId(),closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const cancelClose=()=>{if(closeTimer.current){clearTimeout(closeTimer.current);closeTimer.current=null;}};
 useEffect(()=>()=>{if(closeTimer.current)clearTimeout(closeTimer.current);},[]);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};document.addEventListener('pointerdown',outside);return()=>document.removeEventListener('pointerdown',outside);},[open]);
 return <div ref={root} className="analysis-controls-menu" onPointerEnter={e=>{if(e.pointerType==='mouse'){cancelClose();setOpen(true);}}} onPointerLeave={e=>{if(e.pointerType==='mouse'){cancelClose();closeTimer.current=setTimeout(()=>setOpen(false),180);}}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();setOpen(false);trigger.current?.focus();}}}>
  <button ref={trigger} className="analysis-controls-trigger" aria-pressed={active} aria-expanded={open} aria-controls={id} onClick={()=>{onActivate();setOpen(true);}} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);requestAnimationFrame(()=>root.current?.querySelector<HTMLButtonElement>('.analysis-controls-dropdown button')?.focus());}}}>분석 자료</button>
  {open&&<div id={id} className="analysis-controls-dropdown" role="region" aria-label="분석 자료 보기 설정">{children}</div>}
 </div>;
}
