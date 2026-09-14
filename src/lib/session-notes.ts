"use client";
import {collection,getFirestore,onSnapshot} from 'firebase/firestore';
import {getClientAuth} from './firebase-client';
export type SessionNote={date:string;text:string;revision:number};
export function listenSessionNotes(memberId:string,onData:(notes:SessionNote[])=>void,onError:(e:unknown)=>void){
 const auth=getClientAuth(),uid=auth.currentUser?.uid;if(!uid)throw Error('다시 로그인해주세요.');
 return onSnapshot(collection(getFirestore(auth.app),'trainers',uid,'members',memberId,'sessionNotes'),s=>onData(s.docs.map(d=>({date:d.id,text:d.data().text,revision:d.data().revision}))),onError);
}
