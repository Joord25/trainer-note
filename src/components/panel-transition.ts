"use client";
import {useEffect,useRef} from 'react';
import {flushSync} from 'react-dom';
/** Browser snapshots travel above panel clipping, while the real editor stays mounted. */
export function usePanelTransition(){
 const pending=useRef<ViewTransition|null>(null),sequence=useRef(0);
 useEffect(()=>()=>{sequence.current++;pending.current?.skipTransition();delete document.documentElement.dataset.panelTransition;},[]);
 return (change:()=>void)=>{
  const ticket=++sequence.current;pending.current?.skipTransition();
  if(!document.startViewTransition||matchMedia('(prefers-reduced-motion: reduce)').matches){change();return;}
  document.documentElement.dataset.panelTransition='true';
  const transition=document.startViewTransition(()=>{if(ticket===sequence.current)flushSync(change);});pending.current=transition;
  void transition.finished.catch(()=>{}).finally(()=>{if(ticket===sequence.current){delete document.documentElement.dataset.panelTransition;pending.current=null;}});
 };
}
