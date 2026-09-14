"use client";
import {DisplayPreferenceContext} from '../lib/display-preferences';
import {useContext,useEffect,useRef,useState,type ReactNode,type PointerEvent,type KeyboardEvent} from 'react';
const defaults={two:[34,66],three:[24,50,26],collapsed:[72,28]};
type Layout=keyof typeof defaults;
/** Resize adjacent panels without remounting their editors or document viewers. */
export function ResizableReviewColumns({mode,sourceHidden,children}:{mode:number;sourceHidden:boolean;children:ReactNode}){
 const {preferences,update}=useContext(DisplayPreferenceContext);
 const configured={...defaults,two:[preferences.twoRatio,100-preferences.twoRatio],three:preferences.threeRatio};
 const root=useRef<HTMLDivElement>(null),drag=useRef<{index:number;x:number;width:number;values:number[];layout:Layout}|null>(null);
 const [viewport,setViewport]=useState(0),[sizes,setSizes]=useState<Partial<Record<Layout,number[]>>>({}),[resizing,setResizing]=useState(false);
 useEffect(()=>{const update=()=>setViewport(window.innerWidth);update();window.addEventListener('resize',update);return()=>window.removeEventListener('resize',update);},[]);
 const assistant=mode===3&&viewport>1250,layout:Layout=sourceHidden?'collapsed':assistant?'three':'two';
 const enabled=viewport>760&&(!sourceHidden||assistant),values=sizes[layout]??configured[layout];
 useEffect(()=>{drag.current=null;setResizing(false);},[layout,viewport]);
 useEffect(()=>setSizes({}),[preferences.twoRatio,preferences.threeRatio]);
 function change(index:number,delta:number,base:number[],width:number,key:Layout){
  const sum=base[index]+base[index+1],minimum=Math.min(240/Math.max(width,1)*100,sum/2-3);
  const left=Math.max(minimum,Math.min(sum-minimum,base[index]+delta));
  const next=[...base];next[index]=left;next[index+1]=sum-left;setSizes(prev=>({...prev,[key]:next}));if(key==='two')update({twoRatio:next[0]});if(key==='three')update({threeRatio:next as [number,number,number]});
 }
 function start(e:PointerEvent<HTMLDivElement>,index:number){if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={index,x:e.clientX,width:root.current?.getBoundingClientRect().width||1,values:[...values],layout};setResizing(true);}
 function move(e:PointerEvent<HTMLDivElement>){const d=drag.current;if(!d)return;change(d.index,(e.clientX-d.x)/d.width*100,d.values,d.width,d.layout);}
 function finish(){drag.current=null;setResizing(false);}
 function key(e:KeyboardEvent<HTMLDivElement>,index:number){if(e.key==='Enter'){e.preventDefault();setSizes(v=>({...v,[layout]:configured[layout]}));return;}if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();change(index,(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:2),values,root.current?.clientWidth||1,layout);}
 return <div ref={root} className="review-columns" data-resizing={resizing||undefined} style={enabled?{gridTemplateColumns:values.map(v=>`minmax(0,${v}fr)`).join(' ')}:undefined}>
 {children}
 {enabled&&values.slice(0,-1).map((_,index)=>{const position=values.slice(0,index+1).reduce((a,b)=>a+b,0);return <div key={index} className="review-resize-handle" role="separator" aria-label={sourceHidden?'작업 화면과 우측 패널 너비 조절':index===0?'원본과 작업 화면 너비 조절':'작업 화면과 우측 패널 너비 조절'} aria-orientation="vertical" aria-valuenow={Math.round(position)} aria-valuemin={0} aria-valuemax={100} tabIndex={0} style={{left:`${position}%`}} title="드래그로 너비 조절 · 더블클릭으로 초기화" onPointerDown={e=>start(e,index)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={e=>key(e,index)} onDoubleClick={()=>setSizes(v=>({...v,[layout]:configured[layout]}))}><span/></div>;})}
 </div>;
}
