"use client";
import type {MemberFile} from '../lib/member-files';
import {callAi,aiMessage} from '../lib/server-ai';
import {useBulkSelection,type BulkFailure} from './bulk-selection';
export function useOriginalSelection(memberId:string,files:MemberFile[],online:boolean,before:()=>boolean,onBusy?:(value:boolean)=>void){
 async function remove(items:MemberFile[],operation:'archive'){
  const failed:BulkFailure[]=[];
  for(let i=0;i<items.length;i+=5){const batch=items.slice(i,i+5);try{const result=await callAi({action:'manageSources',memberId,fileIds:batch.map(v=>v.id),operation}) as {failed:BulkFailure[]};failed.push(...result.failed);}catch(e){failed.push(...batch.map(v=>({id:v.id,message:aiMessage(e)})));}}
  return failed;
 }
 return useBulkSelection({items:files,noun:'원본',online,before,onBusy,operations:[
  {id:'archive',label:'원본만 삭제',description:'사진·PDF 파일만 삭제하고 운동 기록과 미확인 판독 내용은 유지합니다.',remove:items=>remove(items,'archive')},
 ]});
}
