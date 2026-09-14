"use client";
import {useEffect,useLayoutEffect,useRef,useState,type ReactNode,type RefObject} from 'react';
import {createPortal} from 'react-dom';
/** One portal target is moved between slots so unsaved form state never remounts. */
export function DockablePanel({right,centerHost,rightHost,children}:{right:boolean;centerHost:RefObject<HTMLDivElement|null>;rightHost:RefObject<HTMLDivElement|null>;children:ReactNode}){
 const [container,setContainer]=useState<HTMLDivElement|null>(null),lastRect=useRef<DOMRect|null>(null),animation=useRef<Animation|null>(null);
 useEffect(()=>{const node=document.createElement('div');node.className='docked-panel-content';setContainer(node);return()=>{animation.current?.cancel();node.remove();};},[]);
 useLayoutEffect(()=>{
  const target=(right?rightHost:centerHost).current;if(!container||!target)return;
  const focus=document.activeElement instanceof HTMLElement&&container.contains(document.activeElement)?document.activeElement:null;
  const previous=lastRect.current;animation.current?.cancel();target.appendChild(container);
  const next=container.getBoundingClientRect();
  if(!document.documentElement.dataset.panelTransition&&previous?.width&&previous.height&&next.width&&next.height&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
   animation.current=container.animate([{transform:`translateX(${right?8:-8}px)`,opacity:.75},{transform:'translateX(0)',opacity:1}],{duration:160,easing:'ease-out'});
  }
  if(next.width&&next.height)lastRect.current=next;
  focus?.focus({preventScroll:true});
  const observer=new ResizeObserver(()=>{const rect=container.getBoundingClientRect();if(rect.width&&rect.height&&animation.current?.playState!=='running')lastRect.current=rect;});observer.observe(container);
  return()=>{observer.disconnect();};
 },[right,container,centerHost,rightHost]);
 return container?createPortal(children,container):null;
}
