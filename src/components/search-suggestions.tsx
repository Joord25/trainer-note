"use client";
import {useEffect,useRef,useState} from 'react';
import {Icon} from './icons';
// Keep Google's supplied markup/style intact. Scripts remain blocked by both
// sandbox and CSP; same-origin access is only needed to measure and scroll it.
export function SearchSuggestions({html}:{html:string}){
 const frame=useRef<HTMLIFrameElement>(null),cleanup=useRef<()=>void>(()=>{});
 const [height,setHeight]=useState(56),[overflow,setOverflow]=useState(false);
 const [atStart,setAtStart]=useState(true),[atEnd,setAtEnd]=useState(false);
 useEffect(()=>()=>cleanup.current(),[]);
 function loaded(){
  cleanup.current();const doc=frame.current?.contentDocument;if(!doc)return;
  const carousel=doc.querySelector<HTMLElement>('.carousel')??doc.body;
  function measure(){
   setHeight(Math.ceil(doc!.body.getBoundingClientRect().height)+4);
   setOverflow(carousel.scrollWidth>carousel.clientWidth+1);
   setAtStart(carousel.scrollLeft<=1);
   setAtEnd(carousel.scrollLeft+carousel.clientWidth>=carousel.scrollWidth-1);
  }
  const observer=new ResizeObserver(measure);observer.observe(doc.body);observer.observe(carousel);
  carousel.addEventListener('scroll',measure,{passive:true});measure();
  cleanup.current=()=>{observer.disconnect();carousel.removeEventListener('scroll',measure);};
 }
 function scroll(direction:number){const doc=frame.current?.contentDocument,el=doc?.querySelector<HTMLElement>('.carousel')??doc?.body;if(el)el.scrollBy({left:direction*el.clientWidth*.75,behavior:'smooth'});}
 const srcDoc=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data: https://www.gstatic.com; base-uri 'none'; form-action 'none'"><base target="_blank"></head><body>${html}<style>html{margin:0}body{margin:0;padding:2px;display:flow-root;min-height:0}</style></body></html>`;
 return <div className="assistant-search-entry"><div className="assistant-search-entry-heading"><span>Google 검색어</span>{overflow&&<span className="assistant-search-navigation"><span>좌우로 확인</span><button type="button" aria-label="이전 Google 검색어 보기" disabled={atStart} onClick={()=>scroll(-1)}><Icon name="chevron" size={13}/></button><button type="button" aria-label="다음 Google 검색어 보기" disabled={atEnd} onClick={()=>scroll(1)}><Icon name="chevron" size={13}/></button></span>}</div><iframe ref={frame} onLoad={loaded} className="assistant-search-suggestions" style={{height}} title="Google 검색 추천" sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={srcDoc}/></div>;
}
