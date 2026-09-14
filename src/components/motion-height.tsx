"use client";
import {useLayoutEffect,useRef,useState,type ReactNode} from 'react';
const ease='cubic-bezier(.22,1,.36,1)';
/** Keep closing content mounted until its height reaches zero; drafts stay intact. */
export function MotionHeight({open=true,children,className=''}:{open?:boolean;children:ReactNode;className?:string}){
 const root=useRef<HTMLDivElement>(null),inner=useRef<HTMLDivElement>(null),animation=useRef<Animation|null>(null),height=useRef(0),isOpen=useRef(open),keep=useRef(children!=null),initial=useRef(true);
 const [content,setContent]=useState(children);
 keep.current=children!=null;
 if(open&&children!==content)setContent(children);
 useLayoutEffect(()=>{
  const first=initial.current;initial.current=false;isOpen.current=open;const node=root.current,body=inner.current;if(!node||!body)return;
  let initialPass=first;
  const update=()=>{
   const next=isOpen.current?body.getBoundingClientRect().height:0;
   if(Math.abs(next-height.current)<.5){if(!isOpen.current&&!keep.current)setContent(null);return;}
   const skipInitial=initialPass&&open;initialPass=false;
   const from=animation.current?.playState==='running'?node.getBoundingClientRect().height:height.current;
   animation.current?.cancel();height.current=next;
   if(skipInitial||window.matchMedia('(prefers-reduced-motion: reduce)').matches){delete node.dataset.animating;if(!isOpen.current&&!keep.current)setContent(null);return;}
   const run=node.animate([{height:from+'px'},{height:next+'px'}],{duration:260,easing:ease});animation.current=run;
   node.dataset.animating='true';run.onfinish=()=>{delete node.dataset.animating;if(!isOpen.current&&!keep.current)setContent(null);};
  };
  update();let frame=0;
  // Nested animated sections can resize their parents; write outside observer delivery.
  const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(update);});observer.observe(body);
  return()=>{observer.disconnect();cancelAnimationFrame(frame);};
 },[open,children!=null]);
 useLayoutEffect(()=>()=>animation.current?.cancel(),[]);
 return <div ref={root} className={'motion-height '+className} style={{height:open?'auto':0}} inert={!open} aria-hidden={!open}><div ref={inner} className="motion-height-inner">{content}</div></div>;
}
