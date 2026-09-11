"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Icon} from './icons';
import type {Member} from '../lib/members';
export function MemberActions({member,compact=false,card=false,available,online,onOpen,onEdit,onUpload,onDelete}:{member:Member;compact?:boolean;card?:boolean;available:boolean;online:boolean;onOpen:()=>void;onEdit:()=>void;onUpload:()=>void;onDelete:()=>void}){
 const id=useId(),button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
 function place(){const b=button.current?.getBoundingClientRect();if(!b)return;const width=200,height=menu.current?.offsetHeight||180;setPosition({left:Math.max(8,Math.min(compact?b.right+8:b.right-width,window.innerWidth-width-8)),top:Math.max(8,Math.min(compact?b.top:b.bottom+6,window.innerHeight-height-8))});}
 useEffect(()=>{if(!open)return;place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};},[open,compact]);
 function act(fn:()=>void){menu.current?.hidePopover();button.current?.focus();fn();}
 return <><button ref={button} type="button" className={'member-action-trigger '+(compact?'compact-member-trigger ':'')+(card?'card-member-trigger':'')} aria-label={`${member.name} ${card?'카드 메뉴':'회원 관리'}`} title={`${member.name} 회원 관리`} aria-expanded={open} popoverTarget={id} onClick={place} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.current?.hidePopover();button.current?.focus();}if(e.key==='ArrowDown'){e.preventDefault();place();menu.current?.showPopover();menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();}}}>{compact&&<span className="compact-member-initial" aria-hidden="true">{member.name.slice(0,1)}</span>}<Icon name="more" size={18}/></button>
 <div ref={menu} id={id} popover="auto" className="member-dropdown" style={position} role="group" aria-label={`${member.name} 작업 메뉴`} onToggle={e=>setOpen(e.newState==='open')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.current?.hidePopover();button.current?.focus();}}}>
 {compact&&<button onClick={()=>act(onOpen)}><Icon name="file" size={15}/>운동 기록 열기</button>}
 <button disabled={!available} onClick={()=>act(onEdit)}><Icon name="edit" size={15}/>회원 정보 수정</button>
 <button disabled={!online||member.pending} onClick={()=>act(onUpload)}><Icon name="plus" size={16}/>일지 추가</button>
 <button className="member-dropdown-delete" disabled={!available||member.pending} onClick={()=>act(onDelete)}>회원 삭제</button>
 </div></>;
}
