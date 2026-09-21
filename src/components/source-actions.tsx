"use client";
import {useId,useRef,useState} from 'react';
import {Icon} from './icons';
import type {MemberFile} from '../lib/member-files';
import {manageSource,aiMessage} from '../lib/server-ai';

export function SourceActions({memberId,file,online,onEdit,onBeforeAction,onNotice,externalBusy=false}:{externalBusy?:boolean;memberId:string;file?:MemberFile;online:boolean;onEdit:()=>void;onBeforeAction:()=>boolean;onNotice:(message:string)=>void}) {
 const id=useId(),menu=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),lock=useRef(false),[busy,setBusy]=useState(false);
 function close(){menu.current?.hidePopover();trigger.current?.focus();}
 function place(){const b=trigger.current?.getBoundingClientRect();if(b&&menu.current){menu.current.style.left=Math.max(8,Math.min(window.innerWidth-248,b.right-240))+'px';menu.current.style.top=Math.max(8,Math.min(window.innerHeight-120,b.bottom+6))+'px';}}
 async function rename(){
  close();if(!file||!online||externalBusy||lock.current||!onBeforeAction())return;
  const name=window.prompt('원본 파일명을 수정해주세요.',file.name);
  if(name===null||name.trim()===file.name)return;
  lock.current=true;setBusy(true);
  try{await manageSource(memberId,file.id,'rename',name);onNotice('파일명을 수정했어요.');}catch(e){onNotice(aiMessage(e));}finally{lock.current=false;setBusy(false);}
 }
 const disabled=!online||busy||externalBusy||!file||file.pending;
 return <><button ref={trigger} popoverTarget={id} aria-label="원본 메뉴" title="원본 수정" disabled={!file||busy||externalBusy} onClick={place}><Icon name="more" size={18}/></button>
 <div ref={menu} id={id} popover="auto" className="member-dropdown" aria-label="원본 수정 메뉴">
 <button disabled={disabled||file?.status!=='ready'} onClick={()=>void rename()}>파일명 수정</button>
 <button disabled={busy||externalBusy||!file||file.status!=='ready'} onClick={()=>{close();onEdit();}}>이 원본의 기록 수정</button>
 </div></>;
}
