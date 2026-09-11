"use client";
import {collection,doc,getFirestore,onSnapshot,query,orderBy,limitToLast} from "firebase/firestore";
import {getFunctions,httpsCallable} from "firebase/functions";
import {getClientAuth} from "./firebase-client";
import type {ExtractedWorkout} from "./workout-extraction";
export const serverAiEnabled=process.env.NEXT_PUBLIC_SERVER_AI_ENABLED==='true';
export type ImportRow=ExtractedWorkout & {review:'auto'|'needs-review'|'confirmed'|'ignored';revision:number};
export type SavedImport={id:string;status:'processing'|'ready'|'error'|'limited';revision:number;rows:ImportRow[];unparsed:{page:number;text:string;reason:string}[];error?:string;year?:number|null;memberConfirmed?:boolean;startedAt?:{toMillis:()=>number}};
export type PlanRow={recordId:string;exerciseName:string;bodyPart?:string;sets:number;reps:string;loadGuide:string;reason:string};
export type SavedPlan={program:PlanRow[];reason:string;basedOn:string;revision:number};
export type Analysis={judgmentContext?:import('../components/judgment-report').JudgmentContext;status:'queued'|'processing'|'ready'|'error'|'limited';fingerprint?:string;startedAt?:{toMillis:()=>number};error?:string;excludedCount?:number;scopeLimit?:number;summary?:{days:number;sets:number;volume:number;autoRecords:number;parts:Record<string,number>;trend:{date:string;sets:number;volume:number}[]};report?:{judgments?:import('../components/judgment-report').JudgmentText[];headline:string;overview:string;findings:{title:string;detail:string;evidenceIds:string[]}[];limitations:string[];questions:string[];program:PlanRow[];quests:string[]}};
export type AiUsage={usedMicros?:number;reservedMicros?:number;monthlyLimitMicros?:number;inputTokens?:number;outputTokens?:number;calls?:number};
function scope(){const auth=getClientAuth(),uid=auth.currentUser?.uid;if(!uid)throw Error('다시 로그인해주세요.');return {db:getFirestore(auth.app),uid,app:auth.app};}
export async function callAi(data:Record<string,unknown>){const s=scope();const result=await httpsCallable<Record<string,unknown>,{error?:string}>(getFunctions(s.app,'us-central1'),'trainerAi',{timeout:180000})(data);if(result.data?.error)throw Error(result.data.error);return result.data;}
export function aiMessage(e:unknown){return e instanceof Error?e.message.replace(/^Firebase: /,''):'AI 작업을 완료하지 못했어요.';}
export function listenImports(mid:string,cb:(rows:SavedImport[])=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(collection(s.db,'trainers',s.uid,'members',mid,'imports'),snapshot=>cb(snapshot.docs.map(d=>({id:d.id,...d.data()} as SavedImport))),error);}
export function listenAiDocument<T>(mid:string,kind:'analysis'|'plans',cb:(v:T|null)=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(doc(s.db,'trainers',s.uid,'members',mid,kind,'current'),snapshot=>{if(!snapshot.metadata.fromCache||snapshot.exists())cb(snapshot.exists()?snapshot.data() as T:null);},error);}
export function listenUsage(cb:(v:AiUsage)=>void,error:(e:unknown)=>void){const s=scope(),month=new Date(Date.now()+9*3600000).toISOString().slice(0,7);return onSnapshot(doc(s.db,'trainers',s.uid,'aiUsage',month),d=>cb(d.data()??{}),error);}

export type ChatMessage={id:string;question:string;fileId:string;previousId:string;status:'processing'|'ready'|'error';answer?:string;references?:string[];questions?:string[];error?:string;selection?:{page:number;rect:{x:number;y:number;width:number;height:number}}};
export function listenChats(mid:string,cb:(v:ChatMessage[])=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(query(collection(s.db,'trainers',s.uid,'members',mid,'chats'),orderBy('createdAt','asc'),limitToLast(40)),snapshot=>cb(snapshot.docs.map(d=>({id:d.id,...d.data()} as ChatMessage))),error);}
