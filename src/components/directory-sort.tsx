"use client";
import {useId,useRef,useState} from 'react';
import {Icon} from './icons';
import type {DisplayPreferences} from '../lib/display-preferences';
export function DirectorySort({value,onChange}:{value:DisplayPreferences['sort'];onChange:(value:DisplayPreferences['sort'])=>void}){
 const id=useId(),menu=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
 const options=[['recent','최근 등록순'],['name','이름순'],['manual','직접 정렬']] as const;
 function place(){const rect=button.current?.getBoundingClientRect();if(rect)setPosition({left:Math.max(8,Math.min(rect.right-184,window.innerWidth-192)),top:rect.bottom+8});}
 return <><button ref={button} className="directory-sort-trigger" aria-label="회원 정렬" aria-expanded={open} popoverTarget={id} onClick={place} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();place();menu.current?.showPopover();menu.current?.querySelector<HTMLButtonElement>('button')?.focus();}}}><Icon name="sort" size={16}/>{options.find(o=>o[0]===value)?.[1]}<Icon name="chevron" size={14}/></button><div id={id} ref={menu} popover="auto" className="directory-sort-menu" style={position} onToggle={e=>setOpen(e.newState==='open')} aria-label="회원 정렬 방식" onKeyDown={e=>{const buttons=Array.from(menu.current?.querySelectorAll('button')??[]),index=buttons.indexOf(document.activeElement as HTMLButtonElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Escape')button.current?.focus();}}>{options.map(([key,label])=><button key={key} aria-pressed={value===key} onClick={()=>{onChange(key);menu.current?.hidePopover();button.current?.focus();}}><span>{label}</span>{value===key&&<Icon name="check" size={15}/>}</button>)}</div></>;
}
