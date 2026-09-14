"use client";
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
type Point={date:string;x:number;y:number|null;sets:number;volume:number|null;notes?:{text:string;label:string}[];sources?:{id:string;label:string}[]};
const number=(v:number)=>v.toLocaleString('ko-KR',{maximumFractionDigits:1});
export function ChartRecordHover({points,metric,children,valueLabel,valueUnit,axisY=247/266*100,onOpenRecord}:{onOpenRecord?:(id:string)=>void;axisY?:number;valueLabel?:string;valueUnit?:string;points:Point[];metric:'sets'|'volume';children:ReactNode}){
 const root=useRef<HTMLDivElement>(null),[width,setWidth]=useState(0);
 useEffect(()=>{const element=root.current;if(!element)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(element);return()=>observer.disconnect();},[]);
 const [active,setActive]=useState<string|null>(null),[pinned,setPinned]=useState(false),id=useId(),point=points.find(p=>p.date===active);
 useEffect(()=>{if(!pinned)return;const close=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node)){setPinned(false);setActive(null);}};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[pinned]);
 function activate(date:string){if(!pinned)setActive(date);}
 function open(p:Point){setActive(p.date);if(onOpenRecord&&p.sources?.length===1){setPinned(false);onOpenRecord(p.sources[0].id);}else if(onOpenRecord&&p.sources?.length){setPinned(true);}}
 const memoVisible=!!point&&(!!point.notes?.length||pinned&&!!point.sources?.length);
 const memoWidth=Math.min(280,Math.max(160,width-16)),memoLeft=point?Math.max(8,Math.min(width-memoWidth-8,width*point.x/100-memoWidth/2)):8;
 const minGap=52,spacing=points.length>1?width*(points.at(-1)!.x-points[0].x)/100/(points.length-1):width;
 const stride=spacing>0?Math.max(1,Math.ceil(minGap/spacing)):Math.max(1,points.length-1);
 const datePoints=points.filter((p,i)=>{
  if(point&&p.date!==point.date&&Math.abs(p.x-point.x)*width/100<minGap)return false;
  return p.date===point?.date||i===0||i===points.length-1||i%stride===0&&(points.at(-1)!.x-p.x)*width/100>=minGap;
 });
 return <div ref={root} className="chart-record-hover" data-active={!!point} onMouseLeave={()=>{if(!pinned)setActive(null);}} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget)){setPinned(false);setActive(null);}}} onKeyDown={e=>{if(e.key==='Escape'){setPinned(false);setActive(null);e.stopPropagation();}}}>
 {children}
 <div className="chart-axis-labels" aria-hidden="true">{datePoints.map(p=><span key={p.date} className="chart-axis-date" data-selected={p.date===active||undefined} style={{left:p.x+'%',top:axisY+'%'}}>{p.date.slice(5)}</span>)}</div>
 <div className="chart-record-targets" aria-label="날짜별 기록 확인">{points.map((p,i)=>{const left=i===0?0:(points[i-1].x+p.x)/2,right=i===points.length-1?100:(p.x+points[i+1].x)/2;return <button key={p.date} type="button" style={{left:left+'%',width:(right-left)+'%'}} aria-label={`${p.date} ${valueLabel??(metric==='sets'?'세트':'볼륨')} 보기`} aria-describedby={active===p.date&&p.y!==null?id:undefined} title={onOpenRecord&&p.sources?.length?'원본 기록 보기':undefined} onMouseEnter={()=>activate(p.date)} onFocus={()=>activate(p.date)} onClick={()=>open(p)} onKeyDown={e=>{if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;e.preventDefault();const sibling=e.key==='ArrowRight'?e.currentTarget.nextElementSibling:e.currentTarget.previousElementSibling;if(sibling instanceof HTMLButtonElement)sibling.focus();}}/>;})}</div>
 {points.filter(p=>p.notes?.length).map(p=><button className="chart-note-marker" key={p.date} type="button" aria-label={`${p.date} 수업 메모 보기`} aria-expanded={active===p.date&&memoVisible} style={{left:p.x+'%',top:(p.y??80)+'%'}} onMouseEnter={()=>activate(p.date)} onFocus={()=>activate(p.date)} onClick={()=>{setActive(p.date);setPinned(true);}}>✎</button>)}
 {memoVisible&&point&&<aside className="chart-session-note" aria-label={`${point.date} 수업 메모`} style={{left:memoLeft,width:memoWidth,top:Math.min(point.y??50,70)+'%'}}><header><strong>{point.notes?.[0]?.label??'원본 기록'}</strong>{pinned&&<button type="button" aria-label="메모 닫기" onClick={()=>{setPinned(false);setActive(null);}}>×</button>}</header><div className="chart-session-note-body">{point.notes?.map((n,i)=><p key={i}>{n.text}</p>)}{pinned&&point.sources&&onOpenRecord&&<div className="chart-session-sources">{point.sources.map(s=><button type="button" key={s.id} onClick={()=>onOpenRecord(s.id)}>{s.label} ↗</button>)}</div>}</div></aside>}
 {point&&point.y!==null&&<div className="chart-record-tooltip" id={id} role="tooltip" style={{left:point.x+'%',top:point.y+'%'}}><strong>{metric==='sets'?number(point.sets)+'세트':point.volume===null?'기록 없음':number(point.volume)+' '+(valueUnit??'kg·회')}</strong></div>}

 </div>;
}
