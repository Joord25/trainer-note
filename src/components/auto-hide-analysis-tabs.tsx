"use client";
import type {RefObject} from 'react';
const tabs=[['summary','통계'],['body','부위별 분포'],['trend','종목별 추이'],['goal','평가 기록']];
export function AutoHideAnalysisTabs({tab,onTab}:{tab:string;onTab:(tab:string)=>void;scrollRef:RefObject<HTMLDivElement|null>}){
 return <div className="analysis-toolbar-row"><div className="analysis-tabs" role="tablist" aria-label="진행 분석 내용">{tabs.map(([id,label])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>onTab(id)}>{label}</button>)}</div></div>;
}
