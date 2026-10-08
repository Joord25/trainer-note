"use client";
import {useRef} from 'react';
import type {GuidanceSource} from './direction-review';
export function GuidanceNote({sources,label='근거',observation}:{sources:GuidanceSource[];label?:string;observation?:string}){
 const dialog=useRef<HTMLDialogElement>(null);
 return <><button type="button" className="guidance-trigger" aria-label={`${label} 보기`} onClick={()=>dialog.current?.showModal()}>ⓘ {label}</button><dialog ref={dialog} className="guidance-note" onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}><header><h3>{label}</h3><button type="button" aria-label="근거 닫기" onClick={()=>dialog.current?.close()}>×</button></header>{observation&&<p>{observation}</p>}<p className="goal-section-note">일반 훈련 기준입니다. 회원의 실제 수행 결과와 구분해 참고해주세요.</p>{sources.length?<ul>{sources.map(s=><li key={s.id}><small>{s.type}</small><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>)}</ul>:<p>연결된 운동 기록을 바탕으로 한 관찰입니다.</p>}</dialog></>;
}
