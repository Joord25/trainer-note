import {validateAssessmentDraft,type AssessmentDraft} from './training-assessment';
export type GoalProposal={primary:string;secondary:string[];detail:string;initialState:string;reviewAfter:number;alignment:{goal:string;assessment:string;gap:string}[];questions:string[];assessment:AssessmentDraft|null};
export type GoalCoaching={proposalId:string;reason:string;remember:boolean;principle:string};
const goals=['좌우 균형 발전','근비대','근력','심폐·체력','다이어트(체지방 감소)','직접 설정'];
export function validateGoalProposal(input:unknown):GoalProposal {
 const v=input as GoalProposal, text=(s:unknown,n:number)=>typeof s==='string'&&s.length<=n;
 if(!v||!goals.includes(v.primary)||!Array.isArray(v.secondary)||v.secondary.length>5||v.secondary.some(s=>!goals.includes(s)||s===v.primary)||new Set(v.secondary).size!==v.secondary.length||!text(v.detail,300)||!v.detail.trim()||!text(v.initialState,500)||!Number.isInteger(v.reviewAfter)||(v.reviewAfter!==0&&(v.reviewAfter<2||v.reviewAfter>40))||!Array.isArray(v.alignment)||!v.alignment.length||v.alignment.length>6||v.alignment.some(a=>!a||!text(a.goal,150)||!a.goal.trim()||!text(a.assessment,500)||!text(a.gap,500))||!Array.isArray(v.questions)||v.questions.length>3||v.questions.some(q=>!text(q,500)||!q.trim()))throw Error('목표 정리 형식을 확인하지 못했어요. 다시 정리해주세요.');
 if([v.primary,...v.secondary].some(g=>!v.alignment.some(a=>a.goal===g)))throw Error('각 목표와 평가의 연결을 다시 정리해주세요.');
 return {primary:v.primary,secondary:v.secondary,detail:v.detail.trim(),initialState:v.initialState.trim(),reviewAfter:v.reviewAfter,alignment:v.alignment.map(a=>({goal:a.goal,assessment:a.assessment,gap:a.gap})),questions:v.questions,assessment:v.assessment?validateAssessmentDraft(v.assessment):null};
}
export function validateGoalCoaching(input:unknown):GoalCoaching|null {
 if(input==null)return null;const v=input as GoalCoaching;
 if(!v||typeof v.proposalId!=='string'||!/^[-a-f0-9]{36}$/.test(v.proposalId)||typeof v.reason!=='string'||v.reason.length>1000||typeof v.remember!=='boolean'||typeof v.principle!=='string'||v.principle.length>500||v.remember&&!v.principle.trim())throw Error('목표 판단 이유와 다음에 참고할 기준을 확인해주세요.');
 return {proposalId:v.proposalId,reason:v.reason.trim(),remember:v.remember,principle:v.principle.trim()};
}
