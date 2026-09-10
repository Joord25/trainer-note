'use client';
import {useEffect,useState} from 'react';
import {Session,programFrom} from './workout-insights';
import {Icon} from './icons';
export function ProgramPlanner({records,goal,review,onSource,onChange}:{records:Session[];goal:string;review:string;onSource:(date:string)=>void;onChange:()=>void}){
 const key=records.map(s=>s.short).join(',')+'|'+goal+'|'+review;
 const [draft,setDraft]=useState(()=>programFrom(records)),[basedOn,setBasedOn]=useState(key),[editing,setEditing]=useState<string|null>(null),[accepted,setAccepted]=useState(false);
 const stale=key!==basedOn;
 useEffect(()=>{if(stale)setAccepted(false)},[stale]);
 const total=draft.reduce((a,r)=>a+r.sets,0);
 function refresh(){setDraft(programFrom(records));setBasedOn(key);setAccepted(false);setEditing(null);onChange()}
 return <section className="program-planner"><div className="section-title"><h3>추천 프로그램</h3><span className="pill">UI 예시 초안</span></div><div className="program-intro"><Icon name="spark" size={17}/><p>최근 기록을 바탕으로 구성을 준비했어요. 무게와 강도는 오늘 상태를 확인한 뒤 정해주세요.</p></div>
 {stale&&<div className="program-stale" role="status">목표 또는 분석 범위가 바뀌었어요.<button onClick={refresh}>새 기준으로 다시 구성</button></div>}
 <div className="program-summary"><span>전신 · 기준 수행 확인</span><b>{draft.length}종목 / {total}세트</b></div>
 <div className="program-list">{draft.map((row,i)=><article key={row.id} className="program-exercise"><div className="program-index">{String(i+1).padStart(2,'0')}</div><div className="program-content"><div className="program-name"><h4>{row.name}</h4><button className="icon-button" aria-label={row.name+' 구성 수정'} onClick={()=>setEditing(editing===row.id?null:row.id)}><Icon name="edit" size={14}/></button></div><div className="program-tags"><span>{row.part}</span><span>{row.sets}세트</span><span>강도 확인 전</span></div><p className="previous-reps">최근 반복 기록: {row.reps}회</p>{editing===row.id&&<div className="program-edit"><label>운동명<input value={row.name} onChange={e=>{setDraft(old=>old.map(r=>r.id===row.id?{...r,name:e.target.value}:r));setAccepted(false);onChange()}}/></label><label>계획 세트<select value={row.sets} onChange={e=>{setDraft(old=>old.map(r=>r.id===row.id?{...r,sets:+e.target.value}:r));setAccepted(false);onChange()}}>{[1,2,3,4,5,6].map(n=><option key={n}>{n}</option>)}</select></label><label>계획 무게 / 강도<input value={row.load} onChange={e=>{setDraft(old=>old.map(r=>r.id===row.id?{...r,load:e.target.value}:r));setAccepted(false);onChange()}}/></label></div>}<details><summary>이렇게 구성한 이유 <Icon name="chevron" size={12}/></summary><p>{row.reason}</p><p className="caption">원본 기반 초안의 근거입니다. 직접 수정한 운동의 적합성은 다시 검토해주세요.</p><button className="text-button" onClick={()=>onSource(row.sourceDate)}>{row.sourceDate} 원본 보기 <Icon name="file" size={12}/></button></details>{row.load!=='트레이너 확인'&&<p className="trainer-load">설정: {row.load}</p>}</div></article>)}</div>
 <div className="program-rationale"><h4>구성 원칙</h4><p>① 최근 수행한 종목으로 비교 기준 유지<br/>② 분포가 적다는 이유만으로 운동 추가하지 않기<br/>③ 스쿼트 종류·기구, 컨디션 확인 후 강도 결정</p></div>
 <button className={'wide '+(accepted?'accepted-program':'primary')} disabled={stale||!draft.length||draft.some(r=>!r.name.trim())} onClick={()=>{setAccepted(true);onChange()}}><Icon name={accepted?'check':'plus'} size={16}/>{accepted?'수업 계획에 반영했어요':'이 구성을 수업 계획에 반영'}</button>
 <p className="caption">종목·세트는 최근 예시 기록을 재사용한 초안이며 개인별 처방 결과가 아닙니다.</p>
 </section>
}
