import {getAuth} from 'firebase-admin/auth';
import {createAccountService} from './account-service.mjs';
import {createGemini} from './gemini.mjs';
import {sameRecordInput} from './record-sync.mjs';
import {initializeApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {getStorage} from 'firebase-admin/storage';
import {getFunctions} from 'firebase-admin/functions';
import {onCall,HttpsError} from 'firebase-functions/v2/https';
import {onDocumentWritten} from 'firebase-functions/v2/firestore';
import {onTaskDispatched} from 'firebase-functions/v2/tasks';
import {defineSecret} from 'firebase-functions/params';
import {createService,safeError} from './service.mjs';
import {MODEL,hash} from './domain.mjs';
initializeApp();
const db=getFirestore(),secret=defineSecret('TRAINER_NOTE_GEMINI_API_KEY');
const region='us-central1',options={region,maxInstances:3,minInstances:0,concurrency:4,memory:'512MiB',timeoutSeconds:180,secrets:[secret]};
const accountService=createAccountService({db,auth:getAuth(),bucket:getStorage().bucket(`${process.env.GCLOUD_PROJECT}.firebasestorage.app`),enqueue:async(data,delay,id)=>{try{await getFunctions().taskQueue(`locations/${region}/functions/purgeTrainerAccount`).enqueue(data,{id,scheduleDelaySeconds:delay,dispatchDeadlineSeconds:540});}catch(e){if(e.code!=='functions/task-already-exists')throw e;}}});
const deletionPending=async uid=>(await db.doc(`accountDeletions/${uid}`).get()).exists;
const gemini=createGemini({apiKey:()=>secret.value()});

const service=createService({db,model:gemini,readSource:async(uid,mid,file)=>{
 const name=file.contentType==='application/pdf'?'source.pdf':file.contentType==='image/png'?'source.png':file.contentType==='image/jpeg'?'source.jpg':null;if(!name)throw Error('지원하지 않는 파일 형식이에요.');
 const object=getStorage().bucket(`${process.env.GCLOUD_PROJECT}.firebasestorage.app`).file(`trainers/${uid}/members/${mid}/files/${file.id}/${name}`),[metadata]=await object.getMetadata();
 if(Number(metadata.size)!==file.size||Number(metadata.size)>10*1024*1024||metadata.contentType!==file.contentType)throw Error('원본 파일 정보를 확인해주세요.');
 const [bytes]=await object.download();if(hash(bytes)!==file.id)throw Error('원본 파일 식별자가 일치하지 않아요.');
 return bytes.toString('base64');
},enqueue:async(data,id)=>{try{await getFunctions().taskQueue(`locations/${region}/functions/buildMemberReport`).enqueue(data,{id:'tn-'+id,scheduleDelaySeconds:30,dispatchDeadlineSeconds:180});}catch(e){if(e.code!=='functions/task-already-exists')throw e;}}});
function input(data){if(!data||typeof data!=='object'||typeof data.memberId!=='string'||!/^[-_a-zA-Z0-9]{1,100}$/.test(data.memberId))throw new HttpsError('invalid-argument','회원 정보를 확인해주세요.');if(data.fileId!==undefined&&!(data.action==='chat'&&data.fileId==='')&&(typeof data.fileId!=='string'||!/^[a-f0-9]{64}$/.test(data.fileId)))throw new HttpsError('invalid-argument','원본 파일을 확인해주세요.');return data;}
export const trainerAi=onCall({...options,enforceAppCheck:true},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','로그인이 필요해요.');const uid=request.auth.uid,data=input(request.data);
 if(await deletionPending(uid))throw new HttpsError('permission-denied','회원탈퇴 처리 중이에요.');
 if(!(await db.doc(`trainers/${uid}/members/${data.memberId}`).get()).exists)throw new HttpsError('not-found','회원 정보를 찾을 수 없어요.');
 try{
  if(['draftGoal','listTrainingPrinciples','removeTrainingPrinciple','saveAssessmentResult','assessmentReview','saveAssessmentDecision'].includes(data.action))return await service[data.action](uid,data.memberId,data);
  if(data.action==='draftAssessment')return await service.draftAssessment(uid,data.memberId,data);
  if(data.action==='trainingGoal')return await service.saveTrainingGoal(uid,data.memberId,data);
  if(['lessonContext','generateLesson','saveConnectedLesson','goalVisual','saveGoalVisualDecision'].includes(data.action))return await service[data.action](uid,data.memberId,data);
  if(data.action==='sessionNote')return await service.saveSessionNote(uid,data.memberId,data);
  if(data.action==='interpretation'){await service.saveInterpretation(uid,data.memberId,data);return {ok:true};}
  if(data.action==='regenerateChat')return await service.regenerateChat(uid,data.memberId,data);
  if(data.action==='newChat')return await service.newChat(uid,data.memberId,data);
  if(data.action==='chat')return await service.chat(uid,data.memberId,data);
  if(data.action==='read'&&data.fileId)return await service.startImport(uid,data.memberId,data.fileId,!!data.retry,data.regenerate===true?{revision:data.revision}:undefined);
  if(data.action==='review'&&data.fileId){await service.reviewImport(uid,data.memberId,data.fileId,data);return {ok:true};}
  if(data.action==='report'){if(data.retry)await service.retryReport(uid,data.memberId,data.regenerate===true);else await service.scheduleReport(uid,data.memberId);return {ok:true};}
  if(data.action==='judgmentCriteria'){await service.saveJudgmentCriteria(uid,data.memberId,data);return {ok:true};}
  if(data.action==='judgmentDecision')return await service.saveJudgmentDecision(uid,data.memberId,data);
  if(data.action==='judgmentOutcome')return await service.saveJudgmentOutcome(uid,data.memberId,data);
  if(data.action==='savePlan'){await service.savePlan(uid,data.memberId,data);return {ok:true};}
  throw Error('지원하지 않는 요청이에요.');
 }catch(e){throw new HttpsError('failed-precondition',safeError(e));}
});
export const readUploadedWorkout=onDocumentWritten({...options,document:'trainers/{uid}/members/{memberId}/files/{fileId}',retry:false},async event=>{
 if(await deletionPending(event.params.uid))return;
 const {uid,memberId,fileId}=event.params,before=event.data?.before.data(),after=event.data?.after.data();
 if(!after){await db.doc(`trainers/${uid}/members/${memberId}/imports/${fileId}`).delete();await service.scheduleReport(uid,memberId);return;}
 if(after.status==='ready'&&before?.status!=='ready')await service.startImport(uid,memberId,fileId);
});
export const reportOnRecordChange=onDocumentWritten({...options,secrets:[],document:'trainers/{uid}/members/{memberId}/records/{recordId}',retry:false},async event=>{
 if(await deletionPending(event.params.uid))return;
 const {uid,memberId,recordId}=event.params,before=event.data?.before.data(),after=event.data?.after.data();
 if(after?.origin==='ai-auto'&&after.status==='provisional')return;
 const sourceHash=after?.sourceHash||before?.sourceHash;
 if(sourceHash){const ref=db.doc(`trainers/${uid}/members/${memberId}/imports/${sourceHash}`);await db.runTransaction(async tx=>{const [snap,latest]=await tx.getAll(ref,db.doc(`trainers/${uid}/members/${memberId}/records/${recordId}`)),v=snap.data(),after=latest.data();if(!v?.rows)return;const i=v.rows.findIndex(r=>r.id===recordId);if(i<0)return;const rows=[...v.rows];if(!after&&rows[i].review==='needs-review')return;let value=rows[i].input;if(after){value={date:after.performedAt.toDate().toISOString().slice(0,10),rawName:after.rawName,exerciseName:after.exerciseName,bodyPart:after.bodyPart,loadType:after.loadType,sets:after.sets,sourceName:after.sourceName,sourceHash:after.sourceHash,sourcePage:after.sourcePage,notes:after.notes,...(after.trainerNote!==undefined?{trainerNote:after.trainerNote}:{}),...(after.measurementType?{measurementType:after.measurementType}:{})};}
 const review=after?'confirmed':'ignored';if(sameRecordInput(value,rows[i].input)&&rows[i].review===review)return;
 rows[i]={...rows[i],input:value,review,issues:[],revision:rows[i].revision+1};tx.update(ref,{rows,revision:v.revision+1});});}
 await service.scheduleReport(uid,memberId);
});
export const reportOnMemberChange=onDocumentWritten({...options,secrets:[],document:'trainers/{uid}/members/{memberId}',retry:false},async event=>{
 if(await deletionPending(event.params.uid))return;
 const before=event.data?.before.data(),after=event.data?.after.data();
 if(!after){await db.recursiveDelete(event.data.before.ref);return;}
 if(before&&(before.goal!==after.goal||before.notes!==after.notes))await service.scheduleReport(event.params.uid,event.params.memberId);
});
export const buildMemberReport=onTaskDispatched({...options,maxInstances:1,concurrency:1,retryConfig:{maxAttempts:1},rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1}},async request=>{const {uid,memberId}=request.data;if(typeof uid!=='string'||uid.includes('/')||typeof memberId!=='string'||memberId.includes('/'))throw Error('Invalid task');if(await deletionPending(uid))return;await service.buildReport(uid,memberId);});

export const trainerAccount=onCall({region,enforceAppCheck:true,maxInstances:3,timeoutSeconds:60},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','로그인이 필요해요.');
 try{
  const data=request.data??{},uid=request.auth.uid;
  if(data.action==='deleteAccount')return await accountService.deleteAccount(uid,{confirmed:data.confirmed,authTime:request.auth.token.auth_time});
  if(data.action==='feedback')return await accountService.feedback(uid,data);
  throw Error('지원하지 않는 요청이에요.');
 }catch(e){throw new HttpsError('failed-precondition',e.message);}
});
export const purgeTrainerAccount=onTaskDispatched({region,timeoutSeconds:540,memory:'512MiB',maxInstances:2,retryConfig:{maxAttempts:10,minBackoffSeconds:60,maxBackoffSeconds:3600},rateLimits:{maxConcurrentDispatches:1}},async request=>accountService.finishDeletion(request.data));
