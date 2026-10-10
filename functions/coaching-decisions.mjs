// Trainer decisions made while discussing a "next lesson direction" analysis.
// The model only proposes; a decision exists only after the trainer saves it.
// Decisions are kept OUT of the analysis inputKey, so saving one never invalidates
// the analysis the trainer is looking at. They overlay it until the next synthesis.
import {GOAL_ASPECTS} from './goal-decision.mjs';
import {withTrainingGuidance} from './training-guidance.mjs';
import {createHash} from 'node:crypto';
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');

export const DISCUSSION_VERSION='direction-discussion-v2';
export const DECISION_CHOICES=['agree','adjust','hold'];
const KINDS=['lens','direction'];
const fail=message=>{throw Error(message);};
const clean=(v,max,required=false)=>{if(typeof v!=='string'||v.length>max||required&&!v.trim())fail('결정 내용의 길이와 형식을 확인해주세요.');return v.trim();};

// Over-interpretations the evidence rules forbid, checked on anything the model proposes to save.
const OVERCLAIMS=[/코어.{0,25}(복부|뱃살).{0,15}(지방|감소|빠)/,/큰\s*근육.{0,20}만.{0,15}(감량|빠지|빠진)/,/예상\s*감량/,/볼륨.{0,15}(늘|증가).{0,20}(근성장|근비대).{0,10}(했|됐|입니다)/];
export function overclaim(text){const t=String(text).replace(/\s+/g,' ');return OVERCLAIMS.some(r=>r.test(t));}

export function validateDiscussionRequest(v){
 if(v==null)return null;
 if(typeof v!=='object'||!KINDS.includes(v.kind)||typeof v.id!=='string'||!/^[-a-z0-9]{1,40}$/i.test(v.id)||typeof v.inputKey!=='string'||!/^[a-f0-9]{64}$/.test(v.inputKey)||typeof v.fingerprint!=='string'||!/^[a-f0-9]{24}$/.test(v.fingerprint))fail('논의할 분석 항목을 확인해주세요. 다음 수업의 방향을 새로 연 뒤 다시 논의해주세요.');
 return {kind:v.kind,id:v.id,inputKey:v.inputKey,fingerprint:v.fingerprint};
}

/** Identity of an analysis item's content. Direction ids are positional and a re-run with the same inputKey can put a
 *  different card at the same id, so discussions and decisions are pinned to this, not to the id alone. */
export const targetFingerprint=value=>digest(value).slice(0,24);
/** Finds the lens or direction in a saved analysis, with its content fingerprint. */
export function findTarget(report,target){
 const found=locate(report,target);
 return {...found,fingerprint:targetFingerprint(found.value)};
}
export function targetFingerprints(report){
 return Object.fromEntries([...(report?.goalReview?.lenses??[]).map(l=>['lens:'+l.id,findTarget(report,{kind:'lens',id:l.id}).fingerprint]),...(report?.directions??[]).map(d=>['direction:'+d.id,findTarget(report,{kind:'direction',id:d.id}).fingerprint])]);
}
function locate(report,target){
 if(target.kind==='lens'){
  const l=report?.goalReview?.lenses?.find(l=>l.id===target.id);
  if(l)return {kind:'lens',id:l.id,label:l.label??GOAL_ASPECTS[l.id]??l.id,value:{id:l.id,label:l.label,status:l.status,observation:l.observation,interpretation:l.interpretation,...(l.comparison?{comparison:l.comparison,recommendation:l.recommendation}:{}),question:l.question}};
 }else{
  const d=report?.directions?.find(d=>d.id===target.id);
  if(d)return {kind:'direction',id:d.id,label:`${GOAL_ASPECTS[d.goalAspect]??'수행 기록'} · ${d.text.slice(0,60)}`,value:{id:d.id,goalAspect:d.goalAspect,kind:d.kind,text:d.text,reason:d.reason,check:d.check}};
 }
 return fail('논의할 분석 항목을 찾지 못했어요. 다음 수업의 방향을 새로 연 뒤 다시 시도해주세요.');
}

const withoutIds=v=>Array.isArray(v)?v.map(withoutIds):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='recordIds'&&k!=='lowRepetitionRecords').map(([k,x])=>[k,withoutIds(x)])):v;
/** The basis the analysis used, minus record-id lists the chat model does not need. */
export function discussionFacts({report,target,goal,checks,programContext,trainerContext,decisions,memberNotes}){
 return {
  target,
  goal,
  memberNotes,
  goalReview:{summary:report.goalReview?.summary??'',reason:report.goalReview?.reason??'',nextStep:report.goalReview?.nextStep??'',lenses:(report.goalReview?.lenses??[]).map(({id,label,status,observation,interpretation,comparison,recommendation,question})=>({id,label,status,observation,interpretation,...(comparison?{comparison,recommendation}:{}),question}))},
  directions:(report.directions??[]).map(({id,goalAspect,kind,text,reason,check})=>({id,goalAspect,kind,text,reason,check})),
  programChecks:withoutIds(checks),
  programContext:{window:programContext.window,completeWeeklyActivityKnown:programContext.completeWeeklyActivityKnown,observed:withoutIds(programContext.observed),weeks:withoutIds(programContext.weeks)},
  trainerContext,
  trainerDecisions:decisions,
 };
}

export const DISCUSSION_PROMPT=`
분석 논의 모드 (${DISCUSSION_VERSION})
facts.discussion은 트레이너가 '다음 수업의 방향' 화면에서 고른 항목(target)과, 그 분석이 쓴 근거(목표, goalReview, programChecks, programContext, 방향 제안, 지도 맥락, 이전에 확정한 결정)다. records는 그 분석과 같은 확인된 기록이다. 당신은 이 분석을 작성한 시니어 트레이너로서, 아래 목표 근거 규칙과 같은 기준으로 대화를 이어간다.
- 먼저 target에 대해 물은 것에 답하고, 판단의 근거가 된 기록 관찰을 짚는다. 분석의 판단을 다시 읽어주기만 하지 말고 왜 그렇게 봤는지 설명한다.
- 트레이너의 설명이 기록과 목표에 맞으면 받아들여 판단을 갱신한다. 목표와 어긋날 수 있으면 이유와 대안을 분명히 말한다. 동의만 반복하지 않는다.
- 트레이너가 알려준 의도·수업 밖 활동·회원 상태는 트레이너가 확인한 사실로 다루되 출처를 바꾸지 않는다. 트레이너의 질문이나 혼잣말을 결정으로, 트레이너의 말을 회원의 요구로 바꾸지 않는다.
- decisionProposal은 트레이너가 방향을 정했거나, 정할 만큼 근거가 모였을 때만 needed=true로 쓴다. choice: agree(현재 판단 유지), adjust(바꿈), hold(보류하고 추가 확인). reason: 트레이너가 말한 근거와 기록을 연결한 1~2문장. target이 direction이고 choice=adjust이면 text(바뀐 다음 수업 행동, 구체적 종목·조건), actionReason(이 회원에게 필요한 이유), check('확인 결과 A이면 …, B이면 …')를 쓴다. 그 외에는 text·actionReason·check를 빈 문자열로 둔다. 아직 논의 중이거나 정보가 부족하면 needed=false이고 나머지는 빈 문자열, choice는 agree로 둔다.
- 제안은 트레이너가 눌러야 저장된다. 저장·반영했다고 말하지 않는다. 기록에 없는 kg나 새 수치 처방을 만들지 않는다.
`;
// Exactly the guidance the analysis itself received (training guidance + goal evidence rules).
export function discussionSystem(){return DISCUSSION_PROMPT+withTrainingGuidance('member-changes',{system:''}).system;}

const str={type:'STRING'};
export const DECISION_PROPOSAL_SCHEMA={type:'OBJECT',properties:{needed:{type:'BOOLEAN'},choice:{type:'STRING',enum:DECISION_CHOICES},reason:str,text:str,actionReason:str,check:str},required:['needed','choice','reason','text','actionReason','check']};
export function discussionSchema(base){return {...base,properties:{...base.properties,decisionProposal:DECISION_PROPOSAL_SCHEMA},required:[...base.required,'decisionProposal']};}

const kgValues=text=>[...String(text).matchAll(/(\d+(?:\.\d+)?)\s*kg(?![·ㆍ])/gi)].map(m=>Number(m[1]));
/** A malformed proposal never blocks the answer: it is dropped with a notice the trainer can see. */
export function validateDecisionProposal(value,target,{kgs=new Set()}={}){
 if(!value||value.needed!==true)return {proposal:null,notice:''};
 const drop={proposal:null,notice:'결정 제안의 형식이 맞지 않아 표시하지 않았어요. 정할 내용을 다시 말해주시면 다시 제안할게요.'};
 const ok=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim().length>0);
 if(!DECISION_CHOICES.includes(value.choice)||!ok(value.reason,300,true))return drop;
 let patch=null;
 if(target.kind==='direction'&&value.choice==='adjust'){
  if(!ok(value.text,400,true)||!ok(value.actionReason,300)||!ok(value.check,300))return drop;
  patch={text:value.text.trim(),reason:value.actionReason.trim(),check:value.check.trim()};
 }
 const words=[value.reason,patch?.text,patch?.reason,patch?.check].filter(Boolean).join(' ');
 if(overclaim(words)||kgValues(words).some(kg=>!kgs.has(kg)))return drop;
 return {proposal:{target:{kind:target.kind,id:target.id,label:target.label},choice:value.choice,reason:value.reason.trim(),patch},notice:''};
}

/** What the trainer saves. A patch only makes sense when a direction is adjusted. */
export function validateDecisionInput(req){
 if(!req||typeof req!=='object')fail('저장할 결정을 확인해주세요.');
 const target=validateDiscussionRequest({...req.target,inputKey:req.inputKey,fingerprint:req.fingerprint});
 if(!DECISION_CHOICES.includes(req.choice))fail('결정(유지·조정·보류)을 선택해주세요.');
 const reason=clean(req.reason,300,true);
 let patch=null;
 if(req.patch!=null){
  if(target.kind!=='direction'||req.choice!=='adjust')fail('조정한 방향에만 수정 내용을 저장할 수 있어요.');
  patch={text:clean(req.patch.text,400,true),reason:clean(req.patch.reason??'',300),check:clean(req.patch.check??'',300)};
 }
 if(overclaim([reason,patch?.text,patch?.reason,patch?.check].filter(Boolean).join(' ')))fail('기록으로 확인할 수 없는 효과 표현이 있어요. 문장을 고친 뒤 저장해주세요.');
 if(typeof req.remember!=='boolean')fail('참고 기준 저장 여부를 확인해주세요.');
 const principle=clean(req.principle??'',500,req.remember);
 const chatId=req.chatId??'';
 if(typeof chatId!=='string'||chatId&&!/^[-a-zA-Z0-9_]{16,80}$/.test(chatId))fail('결정을 제안한 대화를 확인해주세요.');
 return {target,choice:req.choice,reason,patch,remember:req.remember,principle,chatId};
}

/** Which decisions a plan or a synthesis was built with: id + version of each one sent to the model.
 *  version is a fresh random token on every save, so deleting and re-creating a decision never repeats a key. */
export const decisionsForModel=decisions=>decisions.slice(0,10);
export const decisionsKey=decisions=>digest(decisionsForModel(decisions).map(d=>[d.id,d.version])).slice(0,32);
export const modelDecisions=decisions=>decisionsForModel(decisions).map(d=>({about:d.target.label,choice:d.choice,reason:d.reason,changedAction:d.patch?.text??'',changedReason:d.patch?.reason??'',changedCheck:d.patch?.check??'',decidedAt:d.updatedAt?new Date(d.updatedAt+9*3600000).toISOString().slice(0,10):''}));

/** Plain objects for the client and for the next synthesis. */
export function decisionView(id,v){
 return {id,target:v.target,choice:v.choice,reason:v.reason,patch:v.patch??null,fingerprint:v.fingerprint??'',version:v.version??'',revision:v.revision??1,inputKey:v.inputKey,chatId:v.chatId??'',remember:v.remember===true,updatedAt:v.updatedAt?.toMillis?.()??0};
}
