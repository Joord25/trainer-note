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
async function gemini({system,schema,parts,maxOutputTokens,maxInputTokens}){
 const base=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`,headers={'Content-Type':'application/json','x-goog-api-key':secret.value()};
 const generateContentRequest={model:`models/${MODEL}`,systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts}],generationConfig:{responseMimeType:'application/json',responseSchema:schema,temperature:.1,maxOutputTokens}};
 const counted=await fetch(base+':countTokens',{method:'POST',headers,body:JSON.stringify({generateContentRequest}),signal:AbortSignal.timeout(20000)});
 const count=await counted.json();if(!counted.ok)throw Object.assign(Error(count.error?.message||'AI token count failed'),{notBillable:true});
 if(!Number.isInteger(count.totalTokens)||count.totalTokens>maxInputTokens)throw Object.assign(Error('원본이나 기록이 너무 많아요. 파일을 나눠주세요.'),{notBillable:true});
 const {model,...body}=generateContentRequest;
 const response=await fetch(base+':generateContent',{method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(120000)});
 const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error?.message||`AI ${response.status}`),{notBillable:response.status>=400&&response.status<500});
 const m=data.usageMetadata||{},inputTokens=m.promptTokenCount,outputTokens=Number.isInteger(inputTokens)&&(Number.isInteger(m.totalTokenCount)||Number.isInteger(m.candidatesTokenCount))?Math.max(m.totalTokenCount-inputTokens||0,(m.candidatesTokenCount||0)+(m.thoughtsTokenCount||0)):undefined;
 const usage={inputTokens,outputTokens};
 if(data.candidates?.[0]?.finishReason!=='STOP')throw Object.assign(Error('AI 응답이 끝까지 완료되지 않았어요. 파일을 나누거나 다시 시도해주세요.'),{usage});
 let value;try{value=JSON.parse(data.candidates[0].content.parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join(''));}catch{throw Object.assign(Error('AI 응답 형식이 올바르지 않아요.'),{usage});}
 return {value,usage};
}
const service=createService({db,model:gemini,readSource:async(uid,mid,file)=>{
 const name=file.contentType==='application/pdf'?'source.pdf':file.contentType==='image/png'?'source.png':file.contentType==='image/jpeg'?'source.jpg':null;if(!name)throw Error('지원하지 않는 파일 형식이에요.');
 const object=getStorage().bucket(`${process.env.GCLOUD_PROJECT}.firebasestorage.app`).file(`trainers/${uid}/members/${mid}/files/${file.id}/${name}`),[metadata]=await object.getMetadata();
 if(Number(metadata.size)!==file.size||Number(metadata.size)>10*1024*1024||metadata.contentType!==file.contentType)throw Error('원본 파일 정보를 확인해주세요.');
 const [bytes]=await object.download();if(hash(bytes)!==file.id)throw Error('원본 파일 식별자가 일치하지 않아요.');
 return bytes.toString('base64');
},enqueue:async(data,id)=>{try{await getFunctions().taskQueue(`locations/${region}/functions/buildMemberReport`).enqueue(data,{id:'tn-'+id,scheduleDelaySeconds:30,dispatchDeadlineSeconds:180});}catch(e){if(e.code!=='functions/task-already-exists')throw e;}}});
function input(data){if(!data||typeof data!=='object'||typeof data.memberId!=='string'||!/^[-_a-zA-Z0-9]{1,100}$/.test(data.memberId))throw new HttpsError('invalid-argument','회원 정보를 확인해주세요.');if(data.fileId!==undefined&&!/^[a-f0-9]{64}$/.test(data.fileId))throw new HttpsError('invalid-argument','원본 파일을 확인해주세요.');return data;}
export const trainerAi=onCall({...options,enforceAppCheck:true},async request=>{
 if(!request.auth)throw new HttpsError('unauthenticated','로그인이 필요해요.');const uid=request.auth.uid,data=input(request.data);
 if(!(await db.doc(`trainers/${uid}/members/${data.memberId}`).get()).exists)throw new HttpsError('not-found','회원 정보를 찾을 수 없어요.');
 try{
  if(data.action==='read'&&data.fileId)return await service.startImport(uid,data.memberId,data.fileId,!!data.retry);
  if(data.action==='review'&&data.fileId){await service.reviewImport(uid,data.memberId,data.fileId,data);return {ok:true};}
  if(data.action==='report'){if(data.retry)await service.retryReport(uid,data.memberId);else await service.scheduleReport(uid,data.memberId);return {ok:true};}
  if(data.action==='savePlan'){await service.savePlan(uid,data.memberId,data);return {ok:true};}
  throw Error('지원하지 않는 요청이에요.');
 }catch(e){throw new HttpsError('failed-precondition',safeError(e));}
});
export const readUploadedWorkout=onDocumentWritten({...options,document:'trainers/{uid}/members/{memberId}/files/{fileId}',retry:false},async event=>{
 const {uid,memberId,fileId}=event.params,before=event.data?.before.data(),after=event.data?.after.data();
 if(!after){await db.doc(`trainers/${uid}/members/${memberId}/imports/${fileId}`).delete();await service.scheduleReport(uid,memberId);return;}
 if(after.status==='ready'&&before?.status!=='ready')await service.startImport(uid,memberId,fileId);
});
export const reportOnRecordChange=onDocumentWritten({...options,secrets:[],document:'trainers/{uid}/members/{memberId}/records/{recordId}',retry:false},async event=>{
 const {uid,memberId,recordId}=event.params,before=event.data?.before.data(),after=event.data?.after.data();
 if(after?.origin==='ai-auto'&&after.status==='provisional')return;
 const sourceHash=after?.sourceHash||before?.sourceHash;
 if(sourceHash){const ref=db.doc(`trainers/${uid}/members/${memberId}/imports/${sourceHash}`);await db.runTransaction(async tx=>{const [snap,latest]=await tx.getAll(ref,db.doc(`trainers/${uid}/members/${memberId}/records/${recordId}`)),v=snap.data(),after=latest.data();if(!v?.rows)return;const i=v.rows.findIndex(r=>r.id===recordId);if(i<0)return;const rows=[...v.rows];if(!after&&rows[i].review==='needs-review')return;let value=rows[i].input;if(after){value={date:after.performedAt.toDate().toISOString().slice(0,10),rawName:after.rawName,exerciseName:after.exerciseName,bodyPart:after.bodyPart,loadType:after.loadType,sets:after.sets,sourceName:after.sourceName,sourceHash:after.sourceHash,sourcePage:after.sourcePage,notes:after.notes};}
 const review=after?'confirmed':'ignored';if(JSON.stringify(value)===JSON.stringify(rows[i].input)&&rows[i].review===review)return;
 rows[i]={...rows[i],input:value,review,issues:[],revision:rows[i].revision+1};tx.update(ref,{rows,revision:v.revision+1});});}
 await service.scheduleReport(uid,memberId);
});
export const reportOnMemberChange=onDocumentWritten({...options,secrets:[],document:'trainers/{uid}/members/{memberId}',retry:false},async event=>{
 const before=event.data?.before.data(),after=event.data?.after.data();
 if(!after){await db.recursiveDelete(event.data.before.ref);return;}
 if(before&&(before.goal!==after.goal||before.notes!==after.notes))await service.scheduleReport(event.params.uid,event.params.memberId);
});
export const buildMemberReport=onTaskDispatched({...options,maxInstances:1,concurrency:1,retryConfig:{maxAttempts:1},rateLimits:{maxConcurrentDispatches:1,maxDispatchesPerSecond:1}},async request=>{const {uid,memberId}=request.data;if(typeof uid!=='string'||uid.includes('/')||typeof memberId!=='string'||memberId.includes('/'))throw Error('Invalid task');await service.buildReport(uid,memberId);});
