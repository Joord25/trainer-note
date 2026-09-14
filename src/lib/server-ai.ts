"use client";
import {collection,doc,getDoc,getFirestore,onSnapshot,query,orderBy,limitToLast,where,limit,type Timestamp} from "firebase/firestore";
import {getFunctions,httpsCallable} from "firebase/functions";
import {getClientAuth} from "./firebase-client";
import type {ExtractedWorkout} from "./workout-extraction";
export const serverAiEnabled=process.env.NEXT_PUBLIC_SERVER_AI_ENABLED==='true';
export type ImportRow=ExtractedWorkout & {review:'auto'|'needs-review'|'confirmed'|'ignored';revision:number};
export type SavedImport={dismissedReviewAlerts?:string[];id:string;status:'processing'|'ready'|'error'|'limited';revision:number;rows:ImportRow[];unparsed:{page:number;text:string;reason:string}[];error?:string;year?:number|null;memberConfirmed?:boolean;startedAt?:{toMillis:()=>number}};
export type PlanRow={recordId:string;exerciseName:string;bodyPart?:string;sets:number;reps:string;loadGuide:string;reason:string};
export type SavedPlan={lesson?:import('./lesson-planning').LessonDraft;program:PlanRow[];reason:string;basedOn:string;revision:number};
export type Analysis={judgmentContext?:import('../components/judgment-report').JudgmentContext;status:'queued'|'processing'|'ready'|'error'|'limited';fingerprint?:string;startedAt?:{toMillis:()=>number};error?:string;excludedCount?:number;scopeLimit?:number;summary?:{days:number;sets:number;volume:number;autoRecords:number;parts:Record<string,number>;trend:{date:string;sets:number;volume:number}[]};report?:{judgments?:import('../components/judgment-report').JudgmentText[];headline:string;overview:string;findings:{title:string;detail:string;evidenceIds:string[]}[];limitations:string[];questions:string[];program:PlanRow[];quests:string[]}};
export type AiUsage={completedCalls?:number;failedCalls?:number;measuredCalls?:number;totalDurationMs?:number;usedMicros?:number;reservedMicros?:number;monthlyLimitMicros?:number|null;inputTokens?:number;outputTokens?:number;calls?:number};
function scope(){const auth=getClientAuth(),uid=auth.currentUser?.uid;if(!uid)throw Error('다시 로그인해주세요.');return {db:getFirestore(auth.app),uid,app:auth.app};}
export async function callAi(data:Record<string,unknown>){const s=scope();const result=await httpsCallable<Record<string,unknown>,{error?:string}>(getFunctions(s.app,'us-central1'),'trainerAi',{timeout:180000})(data);if(result.data?.error)throw Error(result.data.error);return result.data;}
export function aiMessage(e:unknown){return e instanceof Error?e.message.replace(/^Firebase: /,''):'AI 작업을 완료하지 못했어요.';}
export function listenImports(mid:string,cb:(rows:SavedImport[])=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(collection(s.db,'trainers',s.uid,'members',mid,'imports'),snapshot=>cb(snapshot.docs.map(d=>({id:d.id,...d.data()} as SavedImport))),error);}
export function listenAiDocument<T>(mid:string,kind:'analysis'|'plans',cb:(v:T|null)=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(doc(s.db,'trainers',s.uid,'members',mid,kind,'current'),snapshot=>{if(!snapshot.metadata.fromCache||snapshot.exists())cb(snapshot.exists()?snapshot.data() as T:null);},error);}
export function listenUsage(cb:(v:AiUsage)=>void,error:(e:unknown)=>void){const s=scope(),month=new Date(Date.now()+9*3600000).toISOString().slice(0,7);return onSnapshot(doc(s.db,'trainers',s.uid,'aiUsage',month),d=>cb(d.data()??{}),error);}

export type ChatMessage={contextScope?:{recordCount:number;sessionCount:number;from:string;to:string;capture:boolean};revision?:number;regenerationError?:string;searchNotice?:string;searchSuggestions?:string;webSources?:{url:string;title:string}[];referenceDetails?:{id:string;date:string;exerciseName:string;sourcePage?:number}[];phase?:'checking_search'|'searching_web'|'searching_records'|'analyzing_capture'|'analyzing_records'|'thinking'|'composing'|'complete';generation?:number;captureAvailable?:boolean;id:string;question:string;fileId:string;previousId:string;status:'processing'|'ready'|'error';answer?:string;references?:string[];questions?:string[];error?:string;selection?:{kind?:'source'|'screen';page:number;rect:{x:number;y:number;width:number;height:number}}};
export function listenChats(mid:string,cb:(v:ChatMessage[])=>void,error:(e:unknown)=>void,generation=0,legacyEndAt?:Timestamp|null){
 const s=scope(),chats=collection(s.db,'trainers',s.uid,'members',mid,'chats');
 type DatedChat=ChatMessage&{createdAt:Timestamp};
 let current:DatedChat[]=[],legacy:DatedChat[]=[],ready=false,legacyReady=generation!==0;
 const emit=()=>{if(ready&&legacyReady)cb([...legacy,...current].sort((a,b)=>a.createdAt.toMillis()-b.createdAt.toMillis()||a.id.localeCompare(b.id)).slice(-40));};
 const off=[onSnapshot(query(chats,where('generation','==',generation),orderBy('createdAt','asc'),limitToLast(40)),snapshot=>{current=snapshot.docs.map(d=>({id:d.id,...d.data()} as DatedChat));ready=true;emit();},error)];
 // Before conversation IDs were introduced, messages belonged to conversation 0.
 if(generation===0)off.push(onSnapshot(query(chats,...(legacyEndAt?[where('createdAt','<=',legacyEndAt)]:[]),orderBy('createdAt','asc'),limitToLast(40)),snapshot=>{legacy=snapshot.docs.filter(d=>d.data().generation===undefined).map(d=>({id:d.id,...d.data()} as DatedChat));legacyReady=true;emit();},error));
 return()=>off.forEach(f=>f());
}

export type Interpretation={id:string;alias:string;exerciseName:string;measurementType:string;explanation:string;revision:number};
export function listenInterpretations(cb:(rows:Interpretation[])=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(query(collection(s.db,'trainers',s.uid,'interpretations'),orderBy('updatedAt','desc')),snapshot=>cb(snapshot.docs.map(d=>({id:d.id,...d.data()} as Interpretation))),error);}

export type ChatState={generation:number;startAt?:Timestamp|null};
export type ChatSession={id:string;generation:number;startAt:Timestamp|null;endAt:Timestamp;legacyEndAt?:Timestamp;title:string};
export function listenChatState(mid:string,cb:(v:ChatState)=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(doc(s.db,'trainers',s.uid,'members',mid,'chatState','current'),snapshot=>cb(snapshot.exists()?snapshot.data() as ChatState:{generation:0}),error);}
export function listenChatSessions(mid:string,cb:(v:ChatSession[])=>void,error:(e:unknown)=>void){const s=scope();return onSnapshot(query(collection(s.db,'trainers',s.uid,'members',mid,'chatSessions'),orderBy('endAt','desc'),limit(30)),snapshot=>cb(snapshot.docs.map(d=>({id:d.id,...d.data()} as ChatSession))),error);}

export async function readChatCapture(mid:string,id:string){const s=scope(),snapshot=await getDoc(doc(s.db,'trainers',s.uid,'members',mid,'chatAttachments',id));return snapshot.data()?.image as string|undefined;}

export async function callAccount(data:Record<string,unknown>){const s=scope();return (await httpsCallable<Record<string,unknown>,{status:string;message?:string;receiptId?:string}>(getFunctions(s.app,'us-central1'),'trainerAccount',{timeout:60000})(data)).data;}
