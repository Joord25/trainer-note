'use client';

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

export function BodyMap({stats, compact=false, onSource}: {
  stats: Insights; compact?: boolean; onSource: (date: string) => void;
}) {
  const [selected, setSelected] = useState<PartId | null>(null);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [hovered, setHovered] = useState<PartId | null>(null);
  const [focused, setFocused] = useState<PartId | null>(null);
  const highlighted = hovered ?? focused ?? selected;
  const detailId = useId();
  const visibleParts: PartId[] = side === 'front' ? ['chest', 'shoulders', 'core', 'legs', 'biceps'] : ['back', 'triceps'];
  const part = stats.parts.find(p => p.id === selected);

  return <section className={`muscle-distribution${compact ? ' is-compact' : ''}`} aria-label="부위별 운동 분포">
    <div className="muscle-summary">
      <div><span>기록된 운동</span><strong>{stats.totalSets}<small>세트</small></strong></div>
      <span className="muscle-basis">주동근 · 세트 비중</span>
    </div>
    <div className="atlas-view-switch" aria-label="신체 방향">
      <button type="button" aria-pressed={side === 'front'} onClick={() => {setSide('front'); setSelected(null); setHovered(null); setFocused(null);}}>앞면</button>
      <button type="button" aria-pressed={side === 'back'} onClick={() => {setSide('back'); setSelected(null); setHovered(null); setFocused(null);}}>뒷면</button>
    </div>
    <div className="full-body-atlas">
      <svg viewBox="0 0 100 116" aria-label={`${side === 'front' ? '앞면' : '뒷면'} 신체 부위별 세트 비중`} role="group">
        <g transform="translate(23 0)" aria-hidden="true" className="atlas-base">
          {bodyDrawing[side].silhouette.map((d, i) => <path key={i} d={d} fill="#f0f3f1"/>)}
        </g>
        {visibleParts.map(id => {
          const p = stats.parts.find(p => p.id === id)!;
          const region = muscleRegions[id];
          const style = regionStyle[id];
          const active = selected === id;
          const lit = highlighted === id;
          return <g key={id} className={`atlas-region${lit ? ' is-highlighted' : ''}${active ? ' is-active' : ''}`} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(null)} onFocus={() => setFocused(id)} onBlur={e => {if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(null);}}>
            <g transform={`translate(23 ${region.dy})`} className="atlas-muscle" role="button" tabIndex={0} aria-pressed={active} aria-controls={detailId}
              aria-label={`${p.label} ${p.percent}%, ${p.sets}세트 기록 보기`}
              onClick={() => setSelected(id)} onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); setSelected(id);}}}>
              {region.paths.map((d, i) => <path key={i} d={d} fill={lit ? style.color : 'transparent'} stroke="none" strokeLinejoin="round"/>)}
            </g>
            <path className="atlas-leader" d={`M${style.targetX} ${style.targetY} L${style.endX + (style.x < 50 ? 5 : -5)} ${style.y + 3} H${style.endX}`} fill="none" stroke={lit ? '#648574' : '#c4cfc8'} strokeWidth=".25" aria-hidden="true"/>
            <g className="atlas-label" role="button" tabIndex={0} aria-pressed={active} aria-controls={detailId}
              aria-label={`${p.label} ${p.percent}%, ${p.sets}세트, ${p.sessionDates.length}회 수업`}
              onClick={() => setSelected(id)} onKeyDown={e => {if (e.key === 'Enter' || e.key === ' ') {e.preventDefault(); setSelected(id);}}}>
              <rect x={style.x - 1} y={style.y - 6} width="20" height="18" fill="transparent" rx="2"/>
              <text x={style.x} y={style.y - 1} className="atlas-part-name">{p.label}</text>
              <text x={style.x} y={style.y + 6} className="atlas-part-percent">{p.percent}<tspan className="atlas-percent-sign">%</tspan></text>
              <text x={style.x} y={style.y + 11} className="atlas-part-sets">{p.sets}세트</text>
            </g>
          </g>;
        })}
        <g transform="translate(23 0)" aria-hidden="true" className="atlas-linework" fill="none" strokeLinejoin="round" strokeLinecap="round" pointerEvents="none">
          <g className="atlas-inner-lines">{bodyDrawing[side].lines.map((d, i) => <path key={i} d={d}/>)}</g>
          <g className="atlas-outer-lines">{bodyDrawing[side].silhouette.map((d, i) => <path key={i} d={d}/>)}</g>
        </g>
      </svg>
    </div>
    <div id={detailId} className="muscle-detail" aria-live="polite" aria-atomic="true">
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
    <p className="muscle-footnote">색은 강조한 부위, %는 세트 비중 · 예시 기록 기준 · 보조근 중복 합산 없음{stats.unknownSets > 0 ? ` · 비중에서 미분류 ${stats.unknownSets}세트 제외` : ''}</p>
  </section>;
}
