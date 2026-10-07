'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
const tabs=[['summary','통계'],['body','부위별 분포'],['trend','종목별 추이'],['goal','평가 기록']];
export function AutoHideAnalysisTabs({tab,onTab,scrollRef}:{tab:string;onTab:(tab:string)=>void;scrollRef:RefObject<HTMLDivElement|null>}){
 const [collapsed,setCollapsed]=useState(false),nav=useRef<HTMLDivElement>(null),ignoreUntil=useRef(0);
 function reveal(){ignoreUntil.current=Date.now()+250;setCollapsed(false);}
 useEffect(()=>{
  const el=scrollRef.current;if(!el)return;
  let previous=el.scrollTop,distance=0;
  const scroll=()=>{
   const top=el.scrollTop,delta=top-previous;previous=top;
   if(Date.now()<ignoreUntil.current)return;
   distance=Math.sign(delta)===Math.sign(distance)?distance+delta:delta;
   if(top<8||distance< -24){ignoreUntil.current=Date.now()+250;setCollapsed(false);distance=0;}
   else if(top>48&&distance>24&&!nav.current?.contains(document.activeElement)){
    ignoreUntil.current=Date.now()+250;setCollapsed(true);distance=0;
   }
  };
  el.addEventListener('scroll',scroll,{passive:true});return()=>el.removeEventListener('scroll',scroll);
 },[scrollRef,tab]);
 // Tab selection remounts this component via its key, restoring its expanded state.
 return <div ref={nav} className={'analysis-toolbar-row adaptive-analysis-nav'+(collapsed?' is-collapsed':'')} onMouseEnter={reveal} onFocusCapture={reveal}>
  {collapsed?<button className="analysis-nav-reveal" onClick={reveal} aria-expanded={false}>{tabs.find(([id])=>id===tab)?.[1]} <span>· 메뉴 펼치기⌄</span></button>:<div className="analysis-tabs" role="tablist" aria-label="진행 분석 내용">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>onTab(id)}>{label}</button>)}</div>}
 </div>;
}
