"use client";
import {collection,doc,getFirestore,getDocsFromServer,where,onSnapshot,orderBy,query,runTransaction,serverTimestamp,Timestamp} from "firebase/firestore";
import {getClientAuth} from "./firebase-client";
export const BODY_PARTS = ["가슴","등","어깨","이두","삼두","하체","코어","유산소","전신","미분류"] as const;
import {validMeasurement} from './workout-measurements';
import type {MeasurementType,WorkoutSet} from './workout-measurements';
export type {WorkoutSet} from './workout-measurements';
export type WorkoutInput = {measurementType?:MeasurementType;date:string;rawName:string;exerciseName:string;bodyPart:string;loadType:"weighted"|"bodyweight"|"unknown";sets:WorkoutSet[];sourceName:string;sourceHash:string;sourcePage:number;notes:string;trainerNote?:string};
export type WorkoutRecord = WorkoutInput & {id:string;revision:number;pending:boolean;origin:"manual"|"ai-reviewed"|"ai-auto";status:"confirmed"|"provisional"};
export function validateWorkout(input:WorkoutInput) {
  const v={...input,rawName:input.rawName.trim(),exerciseName:input.exerciseName.trim(),notes:input.notes.trim()};
  const date=new Date(v.date+"T12:00:00Z");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==v.date||v.date<'1900-01-01'||v.date>'2100-12-31')throw new Error("연도를 포함한 올바른 운동 날짜를 입력해주세요.");
  if(!v.exerciseName||v.exerciseName.length>100||v.rawName.length>100)throw new Error("운동 이름은 1~100자로 입력해주세요.");
  if(!(BODY_PARTS as readonly string[]).includes(v.bodyPart)||!["weighted","bodyweight","unknown"].includes(v.loadType))throw new Error("운동 부위와 중량 기준을 확인해주세요.");
  if(!validMeasurement(v))throw new Error("세트의 기록 방식과 단위를 확인해주세요. 거리(m)·시간(초)은 양수로 입력하세요.");
  if(v.trainerNote!==undefined&&(typeof v.trainerNote!=='string'||v.trainerNote.length>1000))throw new Error("운동 메모는 1,000자까지 입력해주세요.");
  if(v.notes.length>1000)throw new Error("메모는 1,000자까지 입력해주세요.");
  if(v.sourceHash?(!/^[a-f0-9]{64}$/.test(v.sourceHash)||!v.sourceName||v.sourceName.length>200||!Number.isInteger(v.sourcePage)||v.sourcePage<1||v.sourcePage>10000):(v.sourceName!==''||v.sourcePage!==0))throw new Error("PDF 원본과 페이지 정보를 확인해주세요.");
  return v;
}
function scope(memberId:string){
  const auth=getClientAuth(),uid=auth.currentUser?.uid;if(!uid)throw new Error("다시 로그인해주세요.");
  const db=getFirestore(auth.app),member=doc(db,"trainers",uid,"members",memberId);
  return {db,member,records:collection(member,"records")};
}
export function listenWorkouts(memberId:string,onData:(r:WorkoutRecord[],cached:boolean)=>void,onError:(e:unknown)=>void){
  return onSnapshot(query(scope(memberId).records,orderBy("performedAt","desc")),{includeMetadataChanges:true},s=>onData(s.docs.map(d=>{const v=d.data();return {...v,id:d.id,date:v.performedAt.toDate().toISOString().slice(0,10),pending:d.metadata.hasPendingWrites} as WorkoutRecord;}),s.metadata.fromCache),onError);
}
export async function saveWorkout(memberId:string,input:WorkoutInput,existing?:WorkoutRecord,importId?:string){
  if(importId&&!/^[a-f0-9]{20}$/.test(importId))throw new Error("판독 기록 식별자를 확인해주세요.");
  const v=validateWorkout(input),s=scope(memberId),reference=existing?doc(s.records,existing.id):importId?doc(s.records,importId):doc(s.records);
  const {date,...fields}=v;
  await runTransaction(s.db,async tx=>{
    const member=await tx.get(s.member),old=await tx.get(reference);
    if(!existing&&old.exists())throw new Error("이미 저장한 판독 기록이에요. 확정 운동 기록에서 확인해주세요.");
    if(!member.exists())throw new Error("회원이 삭제됐어요.");
    if(existing&&(!old.exists()||old.data().revision!==existing.revision))throw new Error("다른 화면에서 기록이 변경됐어요. 닫은 뒤 최신 기록을 다시 열어주세요.");
    const values={...fields,performedAt:Timestamp.fromDate(new Date(date+"T12:00:00Z")),status:"confirmed",origin:existing?.origin??(importId?"ai-reviewed":"manual"),revision:(existing?.revision??0)+1,updatedAt:serverTimestamp()};
    if(existing)tx.update(reference,values);
    else{tx.set(reference,{...values,createdAt:serverTimestamp()});tx.update(s.member,{recordCount:(member.data().recordCount??0)+1,lastRecordId:reference.id,updatedAt:serverTimestamp()});}
  });return reference.id;
}
export async function deleteWorkout(memberId:string,record:WorkoutRecord){
  const s=scope(memberId),reference=doc(s.records,record.id);
  await runTransaction(s.db,async tx=>{
    const member=await tx.get(s.member),old=await tx.get(reference);
    if(!old.exists())return;
    if(!member.exists()||old.data().revision!==record.revision)throw new Error("다른 화면에서 기록이 변경됐어요. 최신 목록에서 다시 삭제해주세요.");
    tx.delete(reference);tx.update(s.member,{recordCount:(member.data().recordCount??0)-1,lastRecordId:record.id,updatedAt:serverTimestamp()});
  });
}
export function summarizeWorkouts(records:WorkoutRecord[]){
  const totals={sets:0,volume:0,excluded:0,days:new Set<string>(),parts:new Map<string,number>()};
  for(const r of records){if(r.pending)continue;totals.days.add(r.date);totals.sets+=r.sets.length;totals.parts.set(r.bodyPart,(totals.parts.get(r.bodyPart)??0)+r.sets.length);for(const s of r.sets){if(r.loadType==='weighted'&&s.kg!==null)totals.volume+=s.kg*s.reps;else totals.excluded++;}}
  return {...totals,volume:Math.round(totals.volume*100)/100};
}
export function workoutError(e:unknown){const code=(e as {code?:string})?.code;if(code==='permission-denied')return "기록에 접근할 수 없어요. 로그인 계정과 서비스 연결을 확인해주세요.";if(code)return "기록을 저장하지 못했어요. 연결 상태를 확인하고 다시 시도해주세요.";return e instanceof Error?e.message:"기록을 처리하지 못했어요.";}

export async function findSourceRecords(memberId:string,sourceHash:string){
  const result=await getDocsFromServer(query(scope(memberId).records,where("sourceHash","==",sourceHash)));
  return result.docs.map(d=>({id:d.id,...d.data()} as WorkoutRecord));
}
