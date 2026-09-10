import {sessions} from './demo-data';
export type Session=(typeof sessions)[number];
export type PartId='legs'|'back'|'chest'|'shoulders'|'core'|'biceps'|'triceps';
export const partDefinitions:{id:PartId;label:string;color:string;hint:string}[]=[
 {id:'chest',label:'가슴',color:'#7ca991',hint:'체스트 프레스'},
 {id:'back',label:'등',color:'#527f72',hint:'시티드 로우 · 랫 풀다운'},
 {id:'shoulders',label:'어깨',color:'#a6bbae',hint:'숄더 프레스'},
 {id:'legs',label:'하체',color:'#789b88',hint:'스쿼트 계열'},
 {id:'core',label:'코어',color:'#bbccbe',hint:'크런치'},
 {id:'biceps',label:'이두',color:'#bc9380',hint:'바벨 컬 · 덤벨 컬 · 해머 컬'},
 {id:'triceps',label:'삼두',color:'#8c9bb8',hint:'트라이셉스 익스텐션 · 푸시다운'},
];
export function partFor(name:string):PartId|null{
 const biceps=/이두|바이셉|(?:바벨|덤벨|해머|프리처|컨센트레이션|케이블)\s*컬|\b(?:biceps?|barbell\s+curl|dumbbell\s+curl|hammer\s+curl|preacher\s+curl|concentration\s+curl|cable\s+curl|(?:bb|db)\s+curl)\b/i.test(name);
 const triceps=/삼두|트라이셉|푸시\s*다운|프레스\s*다운|스컬\s*크러셔|\b(?:triceps?|push\s*down|press\s*down|skull\s*crusher|(?:db|dumbbell)\s+(?:oh|overhead)\s+ext(?:ension)?)\b/i.test(name);
 // Combined arm exercises need separate records before assigning their sets.
 if(biceps && triceps)return null;
 if(biceps)return 'biceps';
 if(triceps)return 'triceps';
 if(/스쿼트|sq/i.test(name))return 'legs';
 if(/로우|풀다운/.test(name))return 'back';
 if(/체스트/.test(name))return 'chest';
 if(/숄더/.test(name))return 'shoulders';
 if(/크런치/.test(name))return 'core';
 return null;
}
export function summarize(records:Session[]){
 const parts=partDefinitions.map(p=>({...p,sets:0,occurrences:0,sessionDates:[] as string[],exercises:[] as string[],percent:0}));
 let unknownSets=0;
 for(const session of records)for(const row of session.rows){
 const count=row[2].split('/').filter(x=>x.trim()).length;
 const part=parts.find(p=>p.id===partFor(row[0]));
 if(!part){unknownSets+=count;continue;}
 part.sets+=count;part.occurrences++;
 if(!part.sessionDates.includes(session.short))part.sessionDates.push(session.short);
 if(!part.exercises.includes(row[0]))part.exercises.push(row[0]);
 }
 const totalSets=parts.reduce((s,p)=>s+p.sets,0)+unknownSets;
 // Largest remainder allocation: displayed percentages always sum to 100 for classified records.
 const classifiedSets=totalSets-unknownSets;
 const raw=parts.map(p=>classifiedSets?p.sets/classifiedSets*100:0);
 const values=raw.map(Math.floor);
 const remainder=classifiedSets?100-values.reduce((a,b)=>a+b,0):0;
 raw.map((v,i)=>({i,f:v-values[i]})).sort((a,b)=>b.f-a.f||a.i-b.i).slice(0,remainder).forEach(({i})=>values[i]++);
 parts.forEach((p,i)=>p.percent=values[i]);
 const top=[...parts].sort((a,b)=>b.sets-a.sets)[0];
 return {parts,totalSets,unknownSets,sessionCount:records.length,top};
}
export type Insights=ReturnType<typeof summarize>;
export type ProgramRow={id:string;name:string;part:string;sets:number;reps:string;load:string;reason:string;sourceDate:string};
export function programFrom(records:Session[]):ProgramRow[]{
 const latest=records[records.length-1];if(!latest)return [];
 return latest.rows.map((row,i)=>({id:'exercise-'+i,name:row[0],part:partDefinitions.find(p=>p.id===partFor(row[0]))?.label||'기타',sets:row[2].split('/').length,reps:row[2],load:'트레이너 확인',reason:i===0?'종류·기구·가동 범위를 먼저 확인해 이전 기록과 비교할 기준을 만듭니다.':'선택 기간의 최근 수업에서 수행한 운동입니다. 먼저 기존 구성으로 초안을 만들고 오늘 상태에 맞춰 검토합니다.',sourceDate:latest.short}));
}
