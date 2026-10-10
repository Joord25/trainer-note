"use client";
import {useId,useRef} from 'react';
import {HoverDetail} from './hover-detail';
import {Icon} from './icons';
import type {GuidanceSource} from './direction-review';
export function GuidanceNote({sources,label='근거',observation,iconOnly=false}:{sources:GuidanceSource[];label?:string;observation?:string;iconOnly?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId();
 return <><HoverDetail wide content={<><strong>{label}</strong><span>일반 훈련 기준과 참고 자료 {sources.length}개를 확인해요. 클릭하면 자세히 볼 수 있어요.</span></>}><button type="button" className={iconOnly?"guidance-trigger guidance-help":"guidance-trigger"} aria-label={`${label} 보기`} aria-haspopup="dialog" onClick={()=>dialog.current?.showModal()}>{iconOnly?<Icon name="help" size={20}/>:<>ⓘ {label}</>}</button></HoverDetail><dialog ref={dialog} className="guidance-note" aria-labelledby={titleId} onClick={e=>{if(e.target===e.currentTarget)dialog.current?.close();}}><header><h3 id={titleId}>{label}</h3><button type="button" aria-label="근거 닫기" onClick={()=>dialog.current?.close()}>×</button></header>{observation&&<p>{observation}</p>}<p className="goal-section-note">일반 훈련 기준이에요. 회원의 실제 수행 결과와 구분해 참고해주세요.</p>{sources.length?<ul>{sources.map(s=><li key={s.id}><small>{s.type}</small><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></li>)}</ul>:<p>연결된 운동 기록을 바탕으로 한 관찰입니다.</p>}</dialog></>;
}
