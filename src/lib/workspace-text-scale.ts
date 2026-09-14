"use client";
import {useEffect,useState} from 'react';

export const WORKSPACE_TEXT_SCALES = [100,112.5,125,150,200] as const;
const changeEvent = 'trainer-note:workspace-text-scale';
const valid = (value:number) => WORKSPACE_TEXT_SCALES.some(scale=>scale===value);

/** One member/workspace preference, shared by every mounted content pane. */
export function useWorkspaceTextScale(memberId:string) {
 const key = `tn-workspace-text:${memberId}`;
 const [scale,setScale] = useState(100);
 useEffect(()=>{
  const read=()=>{try{const value=Number(localStorage.getItem(key));setScale(valid(value)?value:100);}catch{setScale(100);}};
  const changed=(event:Event)=>{const detail=(event as CustomEvent<{key:string;scale:number}>).detail;if(detail?.key===key&&valid(detail.scale))setScale(detail.scale);};
  const stored=(event:StorageEvent)=>{if(event.key===key||event.key===null)read();};
  read();
  window.addEventListener(changeEvent,changed);
  window.addEventListener('storage',stored);
  return()=>{window.removeEventListener(changeEvent,changed);window.removeEventListener('storage',stored);};
 },[key]);
 function update(value:number){
  if(!valid(value))return;
  setScale(value);
  try{localStorage.setItem(key,String(value));}catch{}
  window.dispatchEvent(new CustomEvent(changeEvent,{detail:{key,scale:value}}));
 }
 return [scale,update] as const;
}
