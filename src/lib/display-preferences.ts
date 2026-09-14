"use client";
import {createContext,useCallback,useEffect,useRef,useState} from 'react';
export type DisplayPreferences={cardSize:'small'|'medium'|'large';sort:'recent'|'name';viewMode:2|3;sidebarCollapsed:boolean;theme:'light'|'dark'|'system';font:'original'|'system';textScale:100|112.5|125;twoRatio:number;threeRatio:[number,number,number]};
export const defaultDisplayPreferences:DisplayPreferences={cardSize:'small',sort:'recent',viewMode:2,sidebarCollapsed:false,theme:'system',font:'original',textScale:100,twoRatio:34,threeRatio:[24,50,26]};
export function parseDisplayPreferences(value:string|null):DisplayPreferences{try{const v=JSON.parse(value||'{}');return {cardSize:['small','medium','large'].includes(v?.cardSize)?v.cardSize:'small',sort:v?.sort==='name'?'name':'recent',viewMode:v?.viewMode===3?3:2,sidebarCollapsed:v?.sidebarCollapsed===true,theme:['light','dark'].includes(v?.theme)?v.theme:'system',font:v?.font==='system'?'system':'original',textScale:[100,112.5,125].includes(v?.textScale)?v.textScale:100,twoRatio:typeof v?.twoRatio==='number'?Math.min(65,Math.max(25,v.twoRatio)):34,threeRatio:Array.isArray(v?.threeRatio)&&v.threeRatio.length===3&&v.threeRatio.every((n:unknown)=>typeof n==='number'&&Number.isFinite(n)&&n>=15)&&Math.abs(v.threeRatio.reduce((a:number,b:number)=>a+b,0)-100)<.1?v.threeRatio:[24,50,26]};}catch{return {...defaultDisplayPreferences};}}
export function useDisplayPreferences(uid:string){
 const [state,setState]=useState({uid:'',value:defaultDisplayPreferences}),[error,setError]=useState('');
 const current=useRef(state),key=`trainer-note:display:v1:${uid}`;
 useEffect(()=>{function read(){try{const next={uid,value:parseDisplayPreferences(localStorage.getItem(key))};current.current=next;setState(next);setError('');}catch{const next={uid,value:{...defaultDisplayPreferences}};current.current=next;setState(next);setError('브라우저 저장소를 사용할 수 없어 이번 화면에만 적용돼요.');}}read();function sync(e:StorageEvent){if(e.key===key||e.key===null)read();}window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[uid,key]);
 const update=useCallback((patch:Partial<DisplayPreferences>)=>{const base=current.current.uid===uid?current.current.value:defaultDisplayPreferences;const next={uid,value:parseDisplayPreferences(JSON.stringify({...base,...patch}))};current.current=next;setState(next);try{localStorage.setItem(key,JSON.stringify(next.value));setError('');}catch{setError('설정은 적용했지만 저장하지 못했어요. 다음 접속에서는 기본값으로 열릴 수 있어요.');}},[uid,key]);
 const preferences=state.uid===uid?state.value:defaultDisplayPreferences;
 useEffect(()=>{
  const root=document.documentElement,media=window.matchMedia('(prefers-color-scheme: dark)');
  const apply=()=>{root.dataset.theme=preferences.theme==='system'?(media.matches?'dark':'light'):preferences.theme;root.dataset.font=preferences.font;root.style.setProperty('--display-scale',String(preferences.textScale/100));};
  apply();media.addEventListener('change',apply);return()=>media.removeEventListener('change',apply);
 },[preferences.theme,preferences.font,preferences.textScale]);
 return {preferences:state.uid===uid?state.value:defaultDisplayPreferences,update,error};
}

export const DisplayPreferenceContext=createContext<{preferences:DisplayPreferences;update:(patch:Partial<DisplayPreferences>)=>void}>({preferences:defaultDisplayPreferences,update:()=>{}});
