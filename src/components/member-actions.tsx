"use client";
import {useEffect,useId,useRef,useState} from 'react';
import {Icon} from './icons';
import {memberStatus,type MemberStatus} from '../lib/member-status';
import type {Member} from '../lib/members';
/** A compact mark that still distinguishes members who share a surname. */
export function memberAvatarLabel(name:string){
 const chars=name.trim().replace(/\s+/g,'');
 if(!chars)return '회원';
 if(chars.length===1)return chars;
 return `${chars[0]}${chars[chars.length-1]}`;
}
export function MemberActions({member,compact=false,card=false,compactLabel,available,online,onOpen,onEdit,onUpload,onDelete,onStatus,onMove}:{onMove?:(direction:-1|1)=>void;member:Member;compact?:boolean;card?:boolean;compactLabel?:string;available:boolean;online:boolean;onOpen:()=>void;onEdit:()=>void;onUpload:()=>void;onDelete:()=>void;onStatus:(status:MemberStatus)=>void}){
 const id=useId(),button=useRef<HTMLButtonElement>(null),menu=useRef<HTMLDivElement>(null),[open,setOpen]=useState(false),[position,setPosition]=useState({left:0,top:0});
 function place(){const b=button.current?.getBoundingClientRect();if(!b)return;const width=200,height=menu.current?.offsetHeight||180;setPosition({left:Math.max(8,Math.min(compact?b.right+8:b.right-width,window.innerWidth-width-8)),top:Math.max(8,Math.min(compact?b.top:b.bottom+6,window.innerHeight-height-8))});}
 useEffect(()=>{if(!open)return;place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};},[open,compact]);
 function act(fn:()=>void){menu.current?.hidePopover();button.current?.focus();fn();}
 return <><button ref={button} type="button" className={'member-action-trigger '+(compact?'compact-member-trigger ':'')+(card?'card-member-trigger':'')} aria-label={`${member.name} ${card?'카드 메뉴':'회원 관리'}`} aria-describedby={compact?`${id}-name`:undefined} title={`${member.name} 회원 관리`} aria-expanded={open} popoverTarget={id} onClick={place} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.current?.hidePopover();button.current?.focus();}if(e.key==='ArrowDown'){e.preventDefault();place();menu.current?.showPopover();menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();}}}>{compact&&<><span className="compact-member-initial" aria-hidden="true">{compactLabel||memberAvatarLabel(member.name)}</span><span id={`${id}-name`} className="compact-member-name" role="tooltip">{member.name}</span></>}<Icon name="more" size={18}/></button>
 <div ref={menu} id={id} popover="auto" className="member-dropdown" style={position} role="group" aria-label={`${member.name} 작업 메뉴`} onToggle={e=>setOpen(e.newState==='open')} onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();menu.current?.hidePopover();button.current?.focus();}}}>
 {onMove&&<><button onClick={()=>act(()=>onMove(-1))}><Icon name="back" size={15}/>앞으로 옮기기</button><button onClick={()=>act(()=>onMove(1))}><Icon name="forward" size={15}/>뒤로 옮기기</button></>}
 {compact&&<button onClick={()=>act(onOpen)}><Icon name="file" size={15}/>운동 기록 열기</button>}
 <button disabled={!available} onClick={()=>act(onEdit)}><Icon name="edit" size={15}/>회원 정보 수정</button>
 <button disabled={!online||member.pending} onClick={()=>act(onUpload)}><Icon name="plus" size={16}/>일지 추가</button>
 {memberStatus(member.status)!=='active'&&<button disabled={!available||member.pending} onClick={()=>act(()=>onStatus('active'))}><Icon name="refresh" size={15}/>관리 중으로 복원</button>}
 {memberStatus(member.status)==='active'&&<button disabled={!available||member.pending} onClick={()=>act(()=>onStatus('hidden'))}><Icon name="eye-off" size={15}/>회원 숨기기</button>}
 {memberStatus(member.status)!=='ended'&&<button disabled={!available||member.pending} onClick={()=>act(()=>onStatus('ended'))}><Icon name="folder" size={15}/>계약 종료로 이동</button>}
 <button className="member-dropdown-delete" disabled={!available||member.pending} onClick={()=>act(onDelete)}>회원 삭제</button>
 </div></>;
}
