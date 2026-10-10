"use client";
import {ChartRecordHover} from './chart-record-hover';
import {changePresentation,evidencePoints,recordedDays,selectChangeCharts,type ChangeEvidence} from '../lib/change-card-selection';
export type {ChangeEvidence} from '../lib/change-card-selection';
export type ChangeRegion='하체'|'상체'|'코어'|'유산소';
export function evidenceRegion(e:ChangeEvidence,parts:Record<string,string>={}):ChangeRegion|null{
 const part=e.bodyPart??parts[e.recordIds[0]]??(e.kind==='composition'?e.name:'');
 return part==='하체'?'하체':['등','가슴','어깨','이두','삼두','팔','상체'].includes(part)?'상체':part==='코어'?'코어':part==='유산소'?'유산소':null;
}
const fmt=(n:number)=>Number(n.toFixed(2)).toLocaleString('ko-KR');
export function EvidenceGraph({evidence}:{evidence:ChangeEvidence}){
 const points=evidencePoints(evidence);
 if(!points.length)return null;
 const first=points[0],last=points.at(-1)!,previous=points.at(-2),unit=evidence.unit??'세트',diff=last.value-first.value;
 const presentation=changePresentation(evidence);
 if(recordedDays(evidence)<2)return <figure className="brief-chart"><figcaption><span>{evidence.name} · {evidence.label}</span><strong>{fmt(last.value)} {unit}</strong></figcaption><small>{last.date} · 첫 기록, 아직 변화 비교가 어려워요.</small></figure>;
 const min=Math.min(0,...points.map(p=>p.value))*1.15,max=Math.max(1,...points.map(p=>p.value))*1.15;
 // Match the detailed exercise chart: equally spaced record dates, same vertical scale.
 const x=(i:number)=>60+i/(points.length-1)*560,y=(n:number)=>220-(n-min)/(max-min)*175;
 const hoverPoints=points.map((p,i)=>({date:p.date,sets:0,volume:p.value,x:x(i)/680*100,y:y(p.value)/266*100}));
 return <figure className="brief-chart"><figcaption><span>{evidence.name} · {evidence.label}</span><strong>{presentation?.scope} {presentation?.change}</strong><span className="brief-comparison">{fmt(presentation?.baseline.value??first.value)} → {fmt(last.value)} {unit}</span><small>{recordedDays(evidence)}개 기록일 · 비교 {presentation?.baseline.date} → {last.date}</small></figcaption>
 <ChartRecordHover points={hoverPoints} metric="volume" valueLabel={evidence.label} valueUnit={unit}>
 <svg viewBox="0 0 680 266" role="img" aria-label={`${evidence.name} ${evidence.label}: ${points.map(p=>`${p.date} ${p.value}${unit}`).join(', ')}`}>
 {[0,.5,1].map(v=><g key={v}><line x1="55" x2="635" y1={y(min+v*(max-min))} y2={y(min+v*(max-min))} stroke="var(--line,#e2e7e2)"/><text x="45" y={y(min+v*(max-min))+4} textAnchor="end" fill="currentColor" fontSize="11">{fmt(Math.round(min+v*(max-min)))}</text></g>)}
 <polyline points={points.map((p,i)=>`${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--green,#39654d)" strokeWidth="2.5"/>
 {points.map((p,i)=><circle key={p.date} cx={x(i)} cy={y(p.value)} r="4" fill="var(--surface,#fff)" stroke="var(--green,#39654d)" strokeWidth="2"/>)}
 </svg></ChartRecordHover>
 {previous&&diff<0&&last.value>previous.value&&<small>전체 기간은 감소했지만 직전 기록({fmt(previous.value)} {unit})보다 늘었습니다.</small>}</figure>;

}
export type Finding={evidenceId:string;interpretation:string;uncertainty:string};
export function RegionChangeCard({region,evidence,findings,comment,onDetails,onAsk}:{region:ChangeRegion;evidence:ChangeEvidence[];findings:Finding[];comment?:string;onDetails:(e:ChangeEvidence|undefined,region:ChangeRegion)=>void;onAsk?:(question:string,id:string)=>void}){
 const related=findings.filter(f=>evidence.some(e=>e.id===f.evidenceId));
 const charts=selectChangeCharts(evidence);
 const content=charts.length?comment:undefined;
 return <article className="region-change-card"><header><h3>{region}</h3><span>{region==='상체'?'등 · 가슴 · 어깨 · 팔':region==='유산소'?'시간 · 거리 · 수행 조건':''}</span></header>{!evidence.length?<p className="region-empty"><mark className="report-key-point">비교할 기록이 없습니다.</mark></p>:<><div className="region-graphs">{charts.map(e=>{const finding=related.find(f=>f.evidenceId===e.id);return <div className="brief-exercise" key={e.id}><EvidenceGraph evidence={e}/><p className="brief-explanation">{finding?.interpretation||changePresentation(e)?.comment}</p></div>;})}</div>{content&&<p className="region-comment">{content}</p>}{!charts.length&&<p className="region-comment"><mark className="report-key-point">아직 같은 종목을 두 날짜 이상 비교할 수 없습니다.</mark> 개별 기록은 분석 자세히에서 볼 수 있어요.</p>}<footer><button onClick={()=>onDetails(charts[0]??evidence[0],region)}>분석 자세히 <span aria-hidden="true">↗</span></button>{onAsk&&<button onClick={()=>onAsk(`${region}의 변화를 종합해서 짧게 설명해주세요. 근거: ${charts.map(e=>e.observation).join(' / ')}. 수치 변화와 능력 향상을 구분하고, 피로·통증·휴가·복귀는 기록된 내용만 근거로 삼아 다음 지도 방향을 제안해주세요.`.slice(0,1200),charts[0]?.recordIds[0]??evidence[0].recordIds[0])}>AI에게 질문</button>}</footer></>}</article>;
}
