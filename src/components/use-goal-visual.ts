"use client";
import {useEffect,useRef,useState} from 'react';
import {callAi,aiMessage} from '../lib/server-ai';
import {goalVisualInputKey,type GoalVisualReport} from '../lib/goal-visual';
import type {SavedTrainingGoal} from '../lib/training-goals';
import type {WorkoutRecord} from '../lib/workout-records';
import type {AssessmentResult} from '../lib/assessment-results';
export function useGoalVisual({memberId,records,goal,results,notes,period,enabled}:{memberId:string;records:WorkoutRecord[];goal:SavedTrainingGoal|null;results:AssessmentResult[];notes:{date:string;text:string}[];period:string;enabled:boolean}){
 const inputKey=goalVisualInputKey(records,goal,results,notes,period),cache=useRef(new Map<string,GoalVisualReport>()),[revision,setRevision]=useState(0),[error,setError]=useState<{key:string;text:string}|null>(null),[attempt,setAttempt]=useState(0);
 const cacheKey=memberId+inputKey;
 useEffect(()=>{if(!enabled||!goal||cache.current.has(cacheKey))return;let live=true,timer:ReturnType<typeof setTimeout>;setError(null);
  async function request(polls=0){try{const result=await callAi({action:'goalVisual',memberId,period,inputKey,retry:attempt>0}) as unknown as GoalVisualReport&{pending?:boolean;stale?:boolean};if(!live)return;
   if(result.pending&&polls<30){timer=setTimeout(()=>void request(polls+1),4000);return;}
   if(result.stale||result.pending){setError({key:cacheKey,text:'최신 기록 동기화 후 다시 확인해주세요.'});return;}
   if(result.inputKey!==inputKey)throw Error('분석 범위가 변경됐어요. 다시 확인해주세요.');cache.current.set(cacheKey,result);setRevision(v=>v+1);
  }catch(e){if(live)setError({key:cacheKey,text:aiMessage(e)});}}
  timer=setTimeout(()=>void request(),1800);return()=>{live=false;clearTimeout(timer);};
 },[memberId,cacheKey,inputKey,period,enabled,goal?.revision,attempt]);
 const report=cache.current.get(cacheKey)??null;
 return {report,busy:enabled&&!!goal&&!report&&error?.key!==cacheKey,error:error?.key===cacheKey?error.text:'',refresh:()=>{cache.current.delete(cacheKey);setAttempt(v=>v+1);setRevision(revision+1);},onDecision:(choice:string,reason:string)=>{if(report){cache.current.set(cacheKey,{...report,decision:{choice,reason}});setRevision(v=>v+1);}}};
}
