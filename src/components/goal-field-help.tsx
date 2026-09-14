"use client";
import {useId,useLayoutEffect,useRef,useState,type ReactNode} from 'react';

export function GoalFieldHelp({title,label,description,example,children}:{title:string;label:ReactNode;description:string;example:string;children?:ReactNode}){
 const [open,setOpen]=useState(false),id=useId(),trigger=useRef<HTMLButtonElement>(null),note=useRef<HTMLDivElement>(null);
 useLayoutEffect(()=>{
  if(!open)return;
  function position(){
   const button=trigger.current,popup=note.current;if(!button||!popup)return;
   const bounds=button.getBoundingClientRect(),gap=8,pad=12,width=Math.min(300,window.innerWidth-pad*2);
   popup.style.width=width+'px';
   const height=popup.getBoundingClientRect().height;
   popup.style.left=Math.max(pad,Math.min(bounds.left,window.innerWidth-width-pad))+'px';
   const below=bounds.bottom+gap,above=bounds.top-height-gap;
   popup.style.top=Math.max(pad,Math.min(below+height<=window.innerHeight-pad?below:above,window.innerHeight-height-pad))+'px';
  }
  position();window.addEventListener('resize',position);window.addEventListener('scroll',position,true);
  return()=>{window.removeEventListener('resize',position);window.removeEventListener('scroll',position,true);};
 },[open]);
 return <div className="tg-help-field" onKeyDown={e=>{if(open&&e.key==='Escape'){e.preventDefault();e.stopPropagation();note.current?.hidePopover();trigger.current?.focus();}}}>
  <div className="tg-help-heading">{label}<button ref={trigger} type="button" className="tg-help-trigger" aria-label={`${title} 도움말`} aria-expanded={open} aria-controls={id} popoverTarget={id}><span aria-hidden="true">?</span></button></div>
  <div ref={note} id={id} className="tg-field-explanation" popover="auto" role="note" aria-label={`${title} 설명`} onToggle={e=>setOpen(e.newState==='open')}><strong>{title}</strong><p>{description}</p><p className="tg-help-example">{example}</p></div>
  {children}
 </div>;
}
