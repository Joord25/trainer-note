"use client";
import {useEffect,useId,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './icons';
type Option={value:string;label:string};
/** A styled select with keyboard navigation, without the operating system popup. */
export function WorkoutSelect({label,value,options,onChange,disabled=false}:{label:string;value:string;options:Option[];onChange:(value:string)=>void;disabled?:boolean}){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null);
 const [popup,setPopup]=useState<{host:Element;style:CSSProperties}|null>(null),[active,setActive]=useState(0);
 const selected=Math.max(0,options.findIndex(option=>option.value===value));
 function open(index=selected){
  const button=trigger.current;if(!button||button.matches(':disabled'))return;
  const rect=button.getBoundingClientRect(),font=getComputedStyle(button),scale=rect.height/(button.offsetHeight||rect.height),fontSize=parseFloat(font.fontSize)*scale;
  const below=window.innerHeight-rect.bottom-10,above=rect.top-10,up=below<Math.min(240,options.length*fontSize*2.5)&&above>below;
  setActive(index);setPopup({host:button.closest('dialog[open]')||document.body,style:{position:'fixed',left:Math.max(8,Math.min(rect.left,window.innerWidth-rect.width-8)),width:Math.min(rect.width,window.innerWidth-16),...(up?{bottom:window.innerHeight-rect.top+5}:{top:rect.bottom+5}),maxHeight:Math.max(60,Math.min(320,up?above:below)),fontSize,fontFamily:font.fontFamily}});
 }
 function choose(index:number){if(!trigger.current?.matches(':disabled')&&options[index].value!==value)onChange(options[index].value);setPopup(null);trigger.current?.focus({preventScroll:true});}
 function key(e:KeyboardEvent<HTMLButtonElement>){
  if(e.key==='Escape'){if(popup){e.preventDefault();e.stopPropagation();setPopup(null);}return;}
  if(e.key==='Tab'){setPopup(null);return;}
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!popup)open();else setActive(i=>(i+(e.key==='ArrowDown'?1:-1)+options.length)%options.length);return;}
  if(e.key==='Home'||e.key==='End'){e.preventDefault();const index=e.key==='Home'?0:options.length-1;if(popup)setActive(index);else open(index);return;}
  if(e.key==='Enter'||e.key===' '){e.preventDefault();if(popup)choose(active);else open();return;}
  if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey){const index=options.findIndex((option,i)=>i>active&&option.label.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase()));const first=index<0?options.findIndex(option=>option.label.toLocaleLowerCase().startsWith(e.key.toLocaleLowerCase())):index;if(first>=0){e.preventDefault();if(popup)setActive(first);else open(first);}}
 }
 useEffect(()=>{if(!popup)return;
  const dismiss=(event:PointerEvent)=>{if(!trigger.current?.contains(event.target as Node)&&!menu.current?.contains(event.target as Node))setPopup(null);};
  const scroll=(event:Event)=>{if(!menu.current?.contains(event.target as Node))setPopup(null);};
  const close=()=>setPopup(null);
  document.addEventListener('pointerdown',dismiss);document.addEventListener('scroll',scroll,true);window.addEventListener('resize',close);
  return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('scroll',scroll,true);window.removeEventListener('resize',close);};
 },[popup]);
 useEffect(()=>{menu.current?.querySelector(`[data-option-index="${active}"]`)?.scrollIntoView({block:'nearest'});},[active,popup]);
 return <><button ref={trigger} className="workout-select-trigger" type="button" role="combobox" aria-label={label} aria-haspopup="listbox" aria-expanded={!!popup} aria-controls={popup?id:undefined} aria-activedescendant={popup?`${id}-${active}`:undefined} disabled={disabled} onClick={()=>popup?setPopup(null):open()} onKeyDown={key} onBlur={()=>setPopup(null)}><span>{options.find(option=>option.value===value)?.label||'선택'}</span><Icon name="chevron" size={15}/></button>{popup&&createPortal(<div ref={menu} id={id} role="listbox" aria-label={label} className="workout-select-menu" style={popup.style} onPointerDown={e=>e.preventDefault()} onClick={e=>e.stopPropagation()}>{options.map((option,index)=><div key={option.value} id={`${id}-${index}`} role="option" aria-selected={option.value===value} data-option-index={index} data-active={active===index} onPointerMove={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.label}</span>{option.value===value&&<Icon name="check" size={15}/>}</div>)}</div>,popup.host)}</>;
}
