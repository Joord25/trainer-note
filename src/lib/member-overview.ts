"use client";
import {useEffect,useState} from 'react';
import {getFunctions,httpsCallable} from 'firebase/functions';
import {getClientAuth} from './firebase-client';
export type MemberOverview={goal?:string;secondary?:string[];lastRecordDate?:string;hasAnalysis?:boolean;hasPlan?:boolean;analysisDate?:string;error?:boolean};
export function useMemberOverviews(uid:string,ids:string[],enabled:boolean){
 const key=JSON.stringify(ids),[state,setState]=useState<{uid:string;rows:Record<string,MemberOverview>}>({uid,rows:{}});
 useEffect(()=>{
  if(!enabled)return;
  let active=true;
  const memberIds=JSON.parse(key) as string[];
  const read=httpsCallable<{memberIds:string[]},Record<string,MemberOverview>>(getFunctions(getClientAuth().app,'us-central1'),'trainerDirectory');
  async function load(){for(let i=0;i<memberIds.length;i+=50){const batch=memberIds.slice(i,i+50);let rows:Record<string,MemberOverview>;
   try{rows=(await read({memberIds:batch})).data;}catch{rows=Object.fromEntries(batch.map(id=>[id,{error:true}]));}
   if(!active)return;setState(old=>({uid,rows:{...(old.uid===uid?old.rows:{}),...rows}}));
  }}
  void load();return()=>{active=false;};
 },[uid,key,enabled]);
 return state.uid===uid?state.rows:{};
}
export function overviewGoal(overview:MemberOverview|undefined,legacy:string){
 if(overview?.error)return '목표 확인 불가';
 if(!overview)return legacy||'목표 확인 중…';
 return overview.goal||'목표 미설정';
}
