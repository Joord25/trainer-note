"use client";
import {getAI,getGenerativeModel,GoogleAIBackend} from 'firebase/ai';
import {extractionResponseSchema} from './extraction-schema';
import {getToken} from 'firebase/app-check';
import {getClientAuth,getClientAppCheck} from './firebase-client';
import {EXTRACTION_MODEL,EXTRACTION_PROMPT,MAX_AI_BYTES,parseExtraction} from './workout-extraction';
import type {MemberFile} from './member-files';
export const aiEnabled=process.env.NEXT_PUBLIC_AI_ENABLED==='true';
export async function extractWorkout(blob:Blob,source:MemberFile,memberName:string,year:number|undefined,signal:AbortSignal){
 if(!aiEnabled)throw new Error('AI 판독 연결을 준비 중이에요. 직접 기록을 입력할 수 있어요.');
 if(blob.size>MAX_AI_BYTES)throw new Error('AI 판독은 파일당 10MB까지 가능해요. PDF를 나누거나 이미지를 줄여주세요.');
 const auth=getClientAuth(),uid=auth.currentUser?.uid;if(!uid)throw new Error('다시 로그인해주세요.');
 signal.throwIfAborted();
 const check=getClientAppCheck();if(!check)throw new Error('AI 연결 보호 설정이 필요해요. 관리자에게 문의해주세요.');
 await getToken(check);
 const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 signal.throwIfAborted();if(auth.currentUser?.uid!==uid)throw new Error('로그인 계정이 변경됐어요. 다시 열어주세요.');
 const model=getGenerativeModel(getAI(auth.app,{backend:new GoogleAIBackend()}),{model:EXTRACTION_MODEL,systemInstruction:EXTRACTION_PROMPT,generationConfig:{responseMimeType:'application/json',responseSchema:extractionResponseSchema,temperature:0.1,maxOutputTokens:16384}},{timeout:120000});
 const {response}=await model.generateContent([{text:'첨부한 운동일지를 원본에 근거해 판독해주세요.'},{inlineData:{mimeType:source.contentType,data:btoa(binary)}}],{signal});
 signal.throwIfAborted();if(auth.currentUser?.uid!==uid)throw new Error('로그인 계정이 변경됐어요. 다시 열어주세요.');
 if(response.candidates?.[0]?.finishReason!=='STOP')throw new Error('AI 판독이 끝까지 완료되지 않았어요. 파일을 나누어 다시 시도해주세요.');
 let value:unknown;try{value=JSON.parse(response.text());}catch{throw new Error('AI 응답을 읽지 못했어요. 다시 시도해주세요.');}
 return parseExtraction(value,source,memberName,year);
}
export function aiError(e:unknown){
 const code=(e as {code?:string})?.code;
 if((e as {name?:string})?.name==='AbortError')return '판독을 중단했어요.';
 if(code?.startsWith('appCheck/'))return 'AI 연결 보호 인증을 완료하지 못했어요. 화면을 새로고침하고 다시 시도해주세요.';
 if(code?.startsWith('AI/')){
  const message=e instanceof Error?e.message:'';
  if(/prepayment|credits.*depleted/i.test(message))return 'AI 판독 크레딧이 부족해요. Google AI Studio에서 이 프로젝트의 결제 상태를 확인해주세요.';
  if(/429|quota|resource.exhausted/i.test(message))return 'AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해주세요.';
  if(/403|permission/i.test(message))return 'AI 연결 권한을 확인해야 해요. Firebase AI Logic과 App Check 설정을 확인해주세요.';
  if(/404|not.found/i.test(message))return '설정한 AI 모델에 연결할 수 없어요. 모델 이름과 사용 가능 여부를 확인해주세요.';
  return 'AI 판독을 완료하지 못했어요. 잠시 후 다시 시도하거나 직접 입력해주세요.';
 }
 return e instanceof Error?e.message:'AI 판독을 완료하지 못했어요.';
}
