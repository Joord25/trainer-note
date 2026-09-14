import type {TrainingAssessment} from './training-assessment';
export type AssessmentField={label:string;unit:string;direction:'up'|'down'|'observe';target:number|null};
export type AssessmentResultInput={date:string;values:(number|null)[];conditions:string;stopReason:string;effort:number|null;note:string};
export type AssessmentResult=AssessmentResultInput&{id:string;revision:number;protocolKey:string;assessment:TrainingAssessment;fields:AssessmentField[];updatedAt?:unknown};
export function validateAssessmentFields(input:unknown):AssessmentField[]{
 if(!Array.isArray(input)||!input.length||input.length>6)throw Error('수치 지표는 1~6개로 설정해주세요.');
 const result=input.map(v=>{if(!v||typeof v.label!=='string'||!v.label.trim()||v.label.length>80||typeof v.unit!=='string'||!v.unit.trim()||v.unit.length>30||!['up','down','observe'].includes(v.direction)||v.target!==null&&(!Number.isFinite(v.target)||v.target<0||v.target>1e9)||v.direction==='observe'&&v.target!==null)throw Error('지표 이름·단위·목표값을 확인해주세요.');return {label:v.label.trim(),unit:v.unit.trim(),direction:v.direction,target:v.target} as AssessmentField;});
 if(new Set(result.map(f=>f.label)).size!==result.length)throw Error('지표 이름을 구분해주세요.');return result;
}
export function assessmentConditions(a:TrainingAssessment){const d=a.draft;return d?[...d.steps.map(s=>`${s.name}: ${s.details}`),...d.conditions].join('\n').trim():'';}
export function assessmentProtocol(a:TrainingAssessment,fields:AssessmentField[]){return JSON.stringify({title:a.draft?.title,steps:a.draft?.steps,conditions:a.draft?.conditions,fields:fields.map(({label,unit})=>({label,unit}))});}
export function validateAssessmentResult(input:unknown,fields:AssessmentField[],today:string):AssessmentResultInput {
 const v=input as AssessmentResultInput,text=(s:unknown,n:number)=>typeof s==='string'&&s.length<=n;
 if(!v||!text(v.date,10)||!/^\d{4}-\d{2}-\d{2}$/.test(v.date)||v.date<'1900-01-01'||v.date>today||!Number.isFinite(Date.parse(v.date))||new Date(v.date).toISOString().slice(0,10)!==v.date||!Array.isArray(v.values)||v.values.length!==fields.length||v.values.every(n=>n===null)||v.values.some(n=>n!==null&&(!Number.isFinite(n)||n<0||n>1e9))||!text(v.conditions,1500)||!v.conditions.trim()||!text(v.stopReason,500)||!text(v.note,1000)||v.effort!==null&&(!Number.isFinite(v.effort)||v.effort<0||v.effort>10))throw Error('평가 날짜·수치·수행 조건을 확인해주세요.');
 return {date:v.date,values:v.values,conditions:v.conditions.trim(),stopReason:v.stopReason.trim(),effort:v.effort,note:v.note.trim()};
}
export function comparableResults(rows:AssessmentResult[],protocolKey:string,conditions:string,from='',to='9999-12-31'){return rows.filter(r=>r.protocolKey===protocolKey&&r.conditions===conditions&&r.date>=from&&r.date<=to).sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));}
export function resultTrend(rows:AssessmentResult[],index:number,field:AssessmentField){const points=rows.filter(r=>r.values[index]!==null),first=points[0]?.values[index]??null,last=points.at(-1)?.values[index]??null;return {points,first,last,change:points.length>1&&first!==null&&last!==null?last-first:null,atTarget:last!==null&&field.target!==null&&field.direction!=='observe'?(field.direction==='up'?last>=field.target:last<=field.target):null};}
