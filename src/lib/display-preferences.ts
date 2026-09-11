"use client";
import {useCallback,useEffect,useRef,useState} from 'react';
export type DisplayPreferences={cardSize:'small'|'medium'|'large';sort:'recent'|'name';viewMode:2|3;sidebarCollapsed:boolean};
export const defaultDisplayPreferences:DisplayPreferences={cardSize:'small',sort:'recent',viewMode:2,sidebarCollapsed:false};
function parse(value:string|null):DisplayPreferences{try{const v=JSON.parse(value||'{}');return {cardSize:['small','medium','large'].includes(v?.cardSize)?v.cardSize:'small',sort:v?.sort==='name'?'name':'recent',viewMode:v?.viewMode===3?3:2,sidebarCollapsed:v?.sidebarCollapsed===true};}catch{return {...defaultDisplayPreferences};}}
export function useDisplayPreferences(uid:string){
 const [state,setState]=useState({uid:'',value:defaultDisplayPreferences}),[error,setError]=useState('');
 const current=useRef(state),key=`trainer-note:display:v1:${uid}`;
 useEffect(()=>{function read(){try{const next={uid,value:parse(localStorage.getItem(key))};current.current=next;setState(next);setError('');}catch{const next={uid,value:{...defaultDisplayPreferences}};current.current=next;setState(next);setError('브라우저 저장소를 사용할 수 없어 이번 화면에만 적용돼요.');}}read();function sync(e:StorageEvent){if(e.key===key||e.key===null)read();}window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[uid,key]);
 const update=useCallback((patch:Partial<DisplayPreferences>)=>{const base=current.current.uid===uid?current.current.value:defaultDisplayPreferences;const next={uid,value:parse(JSON.stringify({...base,...patch}))};current.current=next;setState(next);try{localStorage.setItem(key,JSON.stringify(next.value));setError('');}catch{setError('설정은 적용했지만 저장하지 못했어요. 다음 접속에서는 기본값으로 열릴 수 있어요.');}},[uid,key]);
 return {preferences:state.uid===uid?state.value:defaultDisplayPreferences,update,error};
}
