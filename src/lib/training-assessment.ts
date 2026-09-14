import {validateAssessmentFields,type AssessmentField} from './assessment-results';
export const ASSESSMENT_METRICS=['side','strength','cardio','composition','observation'] as const;
export const ASSESSMENT_SOURCES=[
 {id:'10rm',name:'레그프레스·체스트프레스 10RM',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC11441898/',scope:'건강한 20–35세 비훈련 성인. 사전 연습 및 표준화된 레그프레스·체스트프레스 프로토콜의 반복 측정 근거. 일반 일지의 10회 세트와 다름. 통증·의학적 운동 제한 확인 필요.'},
 {id:'walk-mile',name:'1마일 트랙 걷기',url:'https://pubmed.ncbi.nlm.nih.gov/3600239/',scope:'건강한 30–69세 성인. 트랙 1마일 걷기 시간과 심박수를 이용한 VO2max 추정 연구. 러닝머신으로 임의 대체 금지. 예측식·정상 범위 자동 생성 금지.'},
 {id:'chair-stand',name:'30초 의자 일어서기',url:'https://www.cdc.gov/steadi/media/pdfs/STEADI-Assessment-30Sec-508.pdf',scope:'CDC 고령자 하체 기능 평가. 연령·성별 참고 기준은 고령자에 한함. 팔걸이 없는 17인치 의자와 표준 자세·계수법 필요.'},
 {id:'inbody',name:'인바디 체성분 반복 측정',url:'https://pubmed.ncbi.nlm.nih.gov/30472111/',scope:'InBody 230·720·770의 반복 측정과 DXA 비교 연구. 동일 기기·측정 조건 필요. 작은 변화나 기기 간 차이를 목표 달성으로 확정하지 않음.'}
] as const;
export type AssessmentDraft={title:string;purpose:string;steps:{name:string;details:string}[];target:string;measures:string[];conditions:string[];questions:string[];metrics:string[];sourceId:string;fields?:AssessmentField[]};
export type TrainingAssessment={mode:'own'|'recommend';description:string;answers:string;draft:AssessmentDraft|null;confirmed:boolean};
export function validateAssessmentDraft(input:unknown):AssessmentDraft{
 const v=input as AssessmentDraft;const fail=():never=>{throw Error('평가 정리 형식을 확인하지 못했어요. 다시 정리해주세요.');};
 const text=(s:unknown,max:number)=>typeof s==='string'&&s.length<=max;
 const list=(a:unknown,max:number)=>Array.isArray(a)&&a.length<=max&&a.every(s=>text(s,500)&&s.trim());
 if(!v||!text(v.title,120)||!v.title.trim()||!text(v.purpose,500)||!text(v.target,500)||!Array.isArray(v.steps)||v.steps.length>8||v.steps.some(s=>!s||!text(s.name,80)||!s.name.trim()||!text(s.details,600))||!list(v.measures,8)||!list(v.conditions,8)||!list(v.questions,5)||!Array.isArray(v.metrics)||!v.metrics.length||v.metrics.length>5||v.metrics.some(m=>!(ASSESSMENT_METRICS as readonly string[]).includes(m))||typeof v.sourceId!=='string'||v.sourceId!==''&&!ASSESSMENT_SOURCES.some(s=>s.id===v.sourceId))return fail();
 return {...(v.fields?{fields:v.fields.length?validateAssessmentFields(v.fields):[]}:{}),title:v.title.trim(),purpose:v.purpose.trim(),steps:v.steps.map(s=>({name:s.name.trim(),details:s.details.trim()})),target:v.target.trim(),measures:v.measures.map(s=>s.trim()),conditions:v.conditions.map(s=>s.trim()),questions:v.questions.map(s=>s.trim()),metrics:[...new Set(v.metrics)],sourceId:v.sourceId};
}
export function validateTrainingAssessment(input:unknown):TrainingAssessment|null{
 if(input==null)return null;const v=input as TrainingAssessment;
 if(!v||!['own','recommend'].includes(v.mode)||typeof v.description!=='string'||v.description.length>3000||typeof v.answers!=='string'||v.answers.length>2000||typeof v.confirmed!=='boolean')throw Error('평가 방식 입력을 확인해주세요.');
 const draft=v.draft?validateAssessmentDraft(v.draft):null;
 if(v.confirmed&&(!draft||draft.questions.length||!draft.steps.length||!draft.measures.length||v.mode==='recommend'&&!draft.sourceId))throw Error('평가 방법과 확인할 내용을 먼저 정리해주세요.');
 if(v.mode==='own'&&draft?.sourceId)throw Error('트레이너 지정 평가는 연구 기반 평가로 표시할 수 없어요.');
 return {mode:v.mode,description:v.description.trim(),answers:v.answers.trim(),draft,confirmed:v.confirmed};
}
