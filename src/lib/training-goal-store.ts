"use client";
import {doc,getFirestore,onSnapshot} from 'firebase/firestore';
import {getClientAuth} from './firebase-client';
import {callAi} from './server-ai';
import {validateTrainingGoal,type TrainingGoal,type SavedTrainingGoal} from './training-goals';
export function listenTrainingGoal(memberId:string,onData:(goal:SavedTrainingGoal|null)=>void,onError:(error:unknown)=>void){const auth=getClientAuth();if(!auth.currentUser)throw Error('로그인이 필요해요.');return onSnapshot(doc(getFirestore(auth.app),'trainers',auth.currentUser.uid,'members',memberId,'trainingGoals','current'),{includeMetadataChanges:true},s=>{if(!s.metadata.fromCache||s.exists())onData(s.exists()?s.data() as SavedTrainingGoal:null);},onError);}
export async function saveTrainingGoal(memberId:string,input:TrainingGoal,revision:number){return callAi({action:'trainingGoal',memberId,input:validateTrainingGoal(input),revision});}
