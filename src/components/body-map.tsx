'use client';

import type {CardioDistribution} from '../lib/cardio-distribution';
import {useId, useState} from 'react';
import {Insights, PartId} from './workout-insights';
import {Icon} from './icons';
import {bodyDrawing, muscleRegions} from './body-vectors';

const regionStyle: Record<PartId, {color: string; x: number; y: number; endX: number; targetX: number; targetY: number}> = {
  chest: {color: '#73a693', x: 5, y: 34, endX: 25, targetX: 42, targetY: 31},
  shoulders: {color: '#a69abb', x: 78, y: 23, endX: 76, targetX: 61, targetY: 28},
  core: {color: '#c3a16c', x: 78, y: 48, endX: 76, targetX: 54, targetY: 44},
  legs: {color: '#91a875', x: 5, y: 73, endX: 25, targetX: 43, targetY: 67},
  biceps: {color: '#bc9380', x: 5, y: 54, endX: 25, targetX: 37, targetY: 39},
  triceps: {color: '#8c9bb8', x: 5, y: 49, endX: 25, targetX: 38, targetY: 39},
  back: {color: '#789daf', x: 78, y: 37, endX: 76, targetX: 53, targetY: 34},
};

export function BodyMap({stats, cardio, compact=false, onSource, sourceLabel="예시 기록 기준", hideDetails=false, onPartSelect, selectedPart}: {
  stats: Insights; cardio?:CardioDistribution; compact?: boolean; sourceLabel?: string; hideDetails?:boolean; onPartSelect?:(part:string)=>void; selectedPart?:string; onSource: (date: string) => void;
}) {
  const [localSelected, setLocalSelected] = useState<PartId | null>(null);
  const selected=selectedPart?stats.parts.find(p=>p.label===selectedPart)?.id??null:localSelected;
  const setSelected=(id:PartId|null)=>{setLocalSelected(id);const label=stats.parts.find(p=>p.id===id)?.label;if(label)onPartSelect?.(label);};
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [focused, setFocused] = useState<PartId | null>(null);
  const highlighted = hovered ?? focused ?? selected;
  const detailId = useId();
  const part = stats.parts.find(p => p.id === selected);

  return <section className={`muscle-distribution${compact ? ' is-compact' : ''}`} aria-label={`부위별 운동 분포 · ${sourceLabel}`}>
    <div className="muscle-summary">
      <div><span>기록된 운동</span><strong>{stats.totalSets}<small>세트</small></strong></div>
      <span className="muscle-basis">주동근 · 세트 비중</span>
    </div>
    <div className="body-map-overview">
    <div className="paired-body-atlas">
      {(['front','back'] as const).map(side=><figure key={side}><figcaption>{side==='front'?'앞면':'뒷면'}</figcaption><svg viewBox="26 5 48 106" role="group" aria-label={`${side==='front'?'앞면':'뒷면'} 신체 부위`}>
        {/* Scale the back artwork uniformly around its center to match shoulder width and crown/sole alignment. */}
        <g transform={side==='back'?'translate(50 7) scale(1.135841) translate(-50 -8)':undefined}>
        <g transform="translate(23 0)" aria-hidden="true">{bodyDrawing[side].silhouette.map((d,i)=><path key={i} d={d} fill="#f0f3f1"/>)}</g>
        {(side==='front'?['chest','shoulders','core','legs','biceps']:['back','triceps']).map(key=>{const id=key as PartId,p=stats.parts.find(p=>p.id===id)!,region=muscleRegions[id],lit=highlighted===id;return <g key={id} transform={`translate(23 ${region.dy})`} className="atlas-muscle" role="button" tabIndex={0} aria-label={`${p.label} ${p.percent}%, ${p.sets}세트 기록 보기`} aria-pressed={selected===id} onClick={()=>setSelected(id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(id);}}} onMouseEnter={()=>setHovered(id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setFocused(id)} onBlur={()=>setFocused(null)}>{region.paths.map((d,i)=><path key={i} d={d} fill={p.sets||lit?regionStyle[id].color:'transparent'} fillOpacity={lit?1:.38} stroke={lit?'#355d43':'none'} strokeWidth=".35"/>)}</g>;})}
        <g transform="translate(23 0)" className="atlas-linework" fill="none" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none" aria-hidden="true"><g className="atlas-inner-lines">{bodyDrawing[side].lines.map((d,i)=><path key={i} d={d}/>)}</g><g className="atlas-outer-lines">{bodyDrawing[side].silhouette.map((d,i)=><path key={i} d={d}/>)}</g></g>
        </g>
      </svg></figure>)}
    </div>
    <div className="atlas-part-legend" aria-label="부위별 세트 비중">{stats.parts.map(p=><button type="button" key={p.id} aria-pressed={selected===p.id} aria-controls={detailId} onClick={()=>setSelected(p.id)} onMouseEnter={()=>setHovered(p.id)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setFocused(p.id)} onBlur={()=>setFocused(null)}><i style={{background:regionStyle[p.id].color}}/><span>{p.label}</span><strong>{p.percent}%</strong><small>{p.sets}세트</small></button>)}{cardio&&<button type="button" className="atlas-cardio" aria-pressed={selectedPart==='유산소'} onClick={()=>onPartSelect?.('유산소')}><i style={{background:'#bb9367'}}/><span>유산소</span><strong>{cardio.seconds===null?'—':(cardio.seconds/60).toLocaleString('ko-KR',{maximumFractionDigits:1})+'분'}</strong><small>{cardio.days}일</small></button>}</div>
    </div>
    <div hidden={hideDetails} id={detailId} className="muscle-detail" aria-live="polite" aria-atomic="true">
      {part ? <><div className="muscle-detail-heading"><h3>{part.label} 운동 기록</h3><span>{part.sets}세트 · {part.sessionDates.length}회 수업</span></div>
      <p className="muscle-exercise-names">{part.exercises.length ? part.exercises.join(' · ') : '선택한 기간에 이 부위를 주동근으로 기록한 운동이 없어요.'}</p>
      {(selected === 'biceps' || selected === 'triceps') && <p className="muscle-count-note">팔을 주동근으로 분류한 운동만 집계해요. 로우·프레스에서 보조근으로 쓰인 팔은 더하지 않습니다.</p>}
      {!compact && <p className="muscle-count-note">한 수업에서 로우와 풀다운을 했다면 수업은 1회, 수행 항목은 2개예요.</p>}
      {part.sessionDates.length > 0 && <div className="muscle-sources">
        <span>원본 기록</span>
        <div>{part.sessionDates.map(date => <button type="button" key={date} onClick={() => onSource(date)} aria-label={`${part.label} 운동 ${date} 원본 기록 보기`}>
          <Icon name="file" size={14}/>{date}
        </button>)}</div>
      </div>}
      </> : <p className="atlas-select-hint">부위나 이름에 마우스를 올려 확인하고, 클릭해 운동 기록을 열어보세요.</p>}
    </div>

  </section>;
}
