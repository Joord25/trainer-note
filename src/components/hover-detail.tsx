"use client";
import {cloneElement,isValidElement,useEffect,useId,useRef,useState,type ReactElement,type ReactNode} from 'react';
/** The top layer keeps contextual help visible inside clipped, scrollable panes. */
export function HoverDetail({children,content,wide=false}:{children:ReactNode;content:ReactNode;wide?:boolean}){
 const id=useId(),anchor=useRef<HTMLSpanElement>(null),popup=useRef<HTMLSpanElement>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),[position,setPosition]=useState({left:0,top:0});
 function cancel(){if(timer.current)clearTimeout(timer.current);}
 function hide(){cancel();popup.current?.hidePopover();}
 function show(){cancel();const r=anchor.current?.getBoundingClientRect();if(!r)return;const width=Math.min(wide?300:240,window.innerWidth-24);setPosition({left:Math.max(12,Math.min(r.left,window.innerWidth-width-12)),top:Math.min(r.bottom+8,window.innerHeight-(wide?120:72))});popup.current?.showPopover();}
 function later(){cancel();timer.current=setTimeout(hide,160);}
 useEffect(()=>{const close=()=>popup.current?.hidePopover();window.addEventListener('scroll',close,true);window.addEventListener('resize',close);return()=>{if(timer.current)clearTimeout(timer.current);window.removeEventListener('scroll',close,true);window.removeEventListener('resize',close);};},[]);
 return <span className="hover-detail" ref={anchor} onPointerEnter={e=>{if(e.pointerType==='mouse')show();}} onPointerLeave={later} onFocus={show} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget as Node))hide();}} onKeyDown={e=>{if(e.key==='Escape')hide();}} >{isValidElement(children)?cloneElement(children as ReactElement<{'aria-describedby'?:string}>,{'aria-describedby':id}):children}<span id={id} ref={popup} role="tooltip" popover="manual" className={'detail-popover'+(wide?' detail-popover-wide':'')} style={position} onPointerEnter={cancel} onPointerLeave={later}>{content}</span></span>;
}
