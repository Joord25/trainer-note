"use client";

import {useEffect,useRef,useState,type PointerEvent} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './icons';
import type {SourceSelection} from './assistant-chat';

type Point={x:number;y:number};
type Rect=Point&{width:number;height:number};
const rectangle=(a:Point,b:Point):Rect=>({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});

/** Captures only this app's visible viewport. The selected crop attaches on pointer release; sending a question is separate. */
export function ScreenCapture({onCancel,onCapture}:{onCancel:()=>void;onCapture:(selection:SourceSelection)=>void}){
 const [snapshot,setSnapshot]=useState(''),[rect,setRect]=useState<Rect|null>(null),[error,setError]=useState('');
 const canvas=useRef<HTMLCanvasElement|null>(null),start=useRef<Point|null>(null),pointer=useRef<number|null>(null),surface=useRef<HTMLDivElement>(null);
 const viewport=useRef({width:window.innerWidth,height:window.innerHeight});
 const callbacks=useRef({onCancel,onCapture});callbacks.current={onCancel,onCapture};
 useEffect(()=>{
  let live=true;const old=document.activeElement as HTMLElement|null;
  surface.current?.focus();
  const cancel=()=>callbacks.current.onCancel();
  const wheel=(e:WheelEvent)=>e.preventDefault();
  window.addEventListener('resize',cancel);window.addEventListener('wheel',wheel,{passive:false});
  void(async()=>{
   try{
    const {default:html2canvas}=await import('html2canvas');
    if(!live)return;
    const {width,height}=viewport.current;
    const image=await html2canvas(document.body,{x:window.scrollX,y:window.scrollY,width,height,windowWidth:width,windowHeight:height,scale:Math.min(window.devicePixelRatio||1,1.5,Math.sqrt(4000000/(width*height))),useCORS:true,logging:false,backgroundColor:'#ffffff',onclone:doc=>{const style=doc.createElement('style');style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}details:not([open])>:not(summary){display:none!important}summary{list-style:none!important}';doc.head.append(style);}});
    if(!live)return;canvas.current=image;setSnapshot(image.toDataURL('image/png'));
   }catch{if(live)setError('화면을 캡처하지 못했어요. 닫고 다시 시도해주세요.');}
  })();
  return()=>{live=false;canvas.current=null;window.removeEventListener('resize',cancel);window.removeEventListener('wheel',wheel);old?.focus();};
 },[]);
 function point(e:PointerEvent):Point{return {x:Math.max(0,Math.min(viewport.current.width,e.clientX)),y:Math.max(0,Math.min(viewport.current.height,e.clientY))};}
 function down(e:PointerEvent<HTMLDivElement>){if(!snapshot||e.button!==0||e.target!==e.currentTarget)return;e.preventDefault();start.current=point(e);pointer.current=e.pointerId;setRect(null);surface.current?.setPointerCapture(e.pointerId);}
 function move(e:PointerEvent<HTMLDivElement>){if(start.current&&pointer.current===e.pointerId)setRect(rectangle(start.current,point(e)));}
 function up(e:PointerEvent<HTMLDivElement>){if(!start.current||pointer.current!==e.pointerId)return;const next=rectangle(start.current,point(e));start.current=null;pointer.current=null;if(surface.current?.hasPointerCapture(e.pointerId))surface.current.releasePointerCapture(e.pointerId);if(next.width>=12&&next.height>=12){setRect(next);attach(next);}else setRect(null);}
 function attach(rect:Rect){
  if(!canvas.current)return;
  const original=canvas.current,{width,height}=viewport.current;
  const crop=document.createElement('canvas'),scale=Math.min(1.5,1280/Math.max(rect.width,rect.height));crop.width=Math.max(1,Math.round(rect.width*scale));crop.height=Math.max(1,Math.round(rect.height*scale));
  const context=crop.getContext('2d');if(!context){setError('캡처를 만들지 못했어요. 다시 시도해주세요.');return;}
  context.fillStyle='#fff';context.fillRect(0,0,crop.width,crop.height);context.drawImage(original,rect.x*original.width/width,rect.y*original.height/height,rect.width*original.width/width,rect.height*original.height/height,0,0,crop.width,crop.height);
  let image=crop.toDataURL('image/jpeg',.88);
  for(const quality of [.75,.6,.45]){if(image.length<=500000)break;image=crop.toDataURL('image/jpeg',quality);}
  if(image.length>500000){setError('선택 영역이 너무 커요. 조금 작게 선택해주세요.');return;}
  callbacks.current.onCapture({kind:'screen',fileId:'',fileName:'화면 캡처',page:0,rect:{x:rect.x/width,y:rect.y/height,width:rect.width/width,height:rect.height/height},image});
 }
 return createPortal(<div ref={surface} className="screen-capture" data-html2canvas-ignore="true" role="dialog" aria-modal="true" aria-label="화면 영역 캡처" aria-describedby="capture-guide" tabIndex={-1} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={()=>{start.current=null;pointer.current=null;setRect(null);}} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();onCancel();}if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(e.key)&&e.target===e.currentTarget)e.preventDefault();if(e.key==='Tab'){const items=Array.from(surface.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]);const first=items[0],last=items.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===surface.current)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
  {snapshot&&<img className="screen-capture-snapshot" src={snapshot} alt=""/>}
  {rect?<div className="screen-capture-box" style={{left:rect.x,top:rect.y,width:rect.width,height:rect.height}}/>:<div className="screen-capture-shade"/>}
  <p className="screen-capture-guide" id="capture-guide" role="status">{error||(!snapshot?'화면 준비 중…':'캡처할 영역을 드래그하세요. (ESC로 취소)')}</p>
  <button className="screen-capture-close" aria-label="화면 캡처 취소" onClick={onCancel}><Icon name="close" size={22}/></button>
  {snapshot&&<div className="screen-capture-actions"><button onClick={()=>{setError('');attach({x:0,y:0,...viewport.current});}}>화면 전체 선택</button>{rect&&<><button onClick={()=>{setRect(null);setError('');}}>다시 선택</button></>}</div>}
 </div>,document.body);
}
