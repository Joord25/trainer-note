export type ChangeEvidence={id:string;kind:string;bodyPart?:string;name:string;label:string;metric?:string;unit?:string;observation:string;limits:string;recordIds:string[];points?:{date:string;value?:number;sets?:unknown}[]};

export function evidencePoints(e:ChangeEvidence){
 return (e.points??[]).flatMap(p=>typeof p.value==='number'&&Number.isFinite(p.value)&&Number.isFinite(Date.parse(p.date))?[{date:p.date,value:p.value}]:[]).sort((a,b)=>a.date.localeCompare(b.date));
}
export function recordedDays(e:ChangeEvidence){return new Set(evidencePoints(e).map(p=>p.date)).size;}
const metricPriority=(e:ChangeEvidence)=>{
 const points=evidencePoints(e),changed=points.some(p=>p.value!==points[0]?.value);
 // Prefer a changing cardio condition over a flat duration, without labelling it fitness gain.
 if(['speed','incline','distance','duration'].includes(e.metric??''))return (changed?20:0)+({speed:4,incline:3,distance:2,duration:1}[e.metric as 'speed']??0);
 return ({volume:5,kg:4,reps:3,sets:2}[e.metric as 'volume']??0);
};
export function selectChangeCharts(evidence:ChangeEvidence[]){
 const ranked=evidence.filter(e=>e.kind==='exercise'&&recordedDays(e)>=2).sort((a,b)=>recordedDays(b)-recordedDays(a)||metricPriority(b)-metricPriority(a)||evidencePoints(b).at(-1)!.date.localeCompare(evidencePoints(a).at(-1)!.date)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 const seen=new Set<string>();
 return ranked.filter(e=>{const key=JSON.stringify([e.bodyPart,e.name,[...e.recordIds].sort()]);if(seen.has(key))return false;seen.add(key);return true;}).slice(0,2);
}

const formatValue=(n:number)=>Number(n.toFixed(2)).toLocaleString('ko-KR');
export function changePresentation(e:ChangeEvidence){
 const points=evidencePoints(e),first=points[0],last=points.at(-1),previous=points.at(-2);
 if(!first||!last||!previous)return null;
 // Highlight recent recovery while retaining the full-period graph and initial reference.
 const recovering=last.value<first.value&&last.value>previous.value;
 const baseline=recovering?previous:first,delta=last.value-baseline.value;
 const percent=baseline.value===0?null:delta/baseline.value*100;
 const scope=recovering?'직전 대비':'첫 기록 대비';
 const change=percent===null?`${delta>0?'+':''}${formatValue(delta)} ${e.unit??''}`:`${percent>0?'+':''}${formatValue(percent)}%`;
 const observation=recovering?`직전 기록보다 늘었지만 초기 ${formatValue(first.value)}${e.unit??''}에는 아직 못 미칩니다.`:delta>0?'기록된 수치가 첫 기록보다 늘었습니다.':delta<0?'기록된 수치가 첫 기록보다 줄었습니다.':'첫 기록과 최근 수치는 같습니다.';
 const limitation=e.metric==='volume'?'세트 수·반복수·중량 구성을 함께 확인해야 하며, 총량 증가만으로 근력 향상을 판단할 수 없습니다.':'수행 조건이 같은지 함께 확인해야 합니다.';
 return {baseline,last,scope,change,observation,comment:observation+' '+limitation};
}
