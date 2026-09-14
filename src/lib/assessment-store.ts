"use client";
import {collection,getFirestore,onSnapshot,query,limit} from 'firebase/firestore';
import {getClientAuth} from './firebase-client';
import type {AssessmentResult} from './assessment-results';
export function listenAssessmentResults(memberId:string,onData:(v:AssessmentResult[])=>void,onError:(e:unknown)=>void){const auth=getClientAuth();if(!auth.currentUser)throw Error('로그인이 필요해요.');return onSnapshot(query(collection(getFirestore(auth.app),'trainers',auth.currentUser.uid,'members',memberId,'assessmentResults'),limit(500)),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache||!s.empty)onData(s.docs.map(d=>({id:d.id,...d.data()} as AssessmentResult)));},onError);}
