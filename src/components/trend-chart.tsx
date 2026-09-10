'use client';

import {useEffect, useId, useRef, useState} from 'react';
import {Session} from './workout-insights';

export function TrendChart({records, metric, selectedDate, onSource}: {
  records: Session[];
  metric: 'sets' | 'volume';
  selectedDate: string;
  onSource: (date: string) => void;
}) {
  const descriptionId = useId();
  const gradientId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);
  const hasRecords = records.length > 0;
  useEffect(() => {
    if (!container.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width)));
    observer.observe(container.current);
    return () => observer.disconnect();
  }, [hasRecords]);

  const unit = metric === 'sets' ? '세트' : 'kg·회';
  const label = metric === 'sets' ? '총세트' : '기록 볼륨';
  const maxValue = Math.max(metric === 'sets' ? 20 : 4000, ...records.map(r => r[metric]));
  const ceiling = Math.ceil(maxValue / (metric === 'sets' ? 4 : 1000)) * (metric === 'sets' ? 4 : 1000);
  const left = 52, right = width - 24, top = 24, bottom = 188;
  const active = records.find(r => r.short === hovered) ?? records.find(r => r.short === focused)
    ?? records.find(r => r.short === selectedDate) ?? records[records.length - 1];
  const points = records.map((record, index) => ({
    record,
    x: records.length === 1 ? (left + right) / 2 : left + index / (records.length - 1) * (right - left),
    y: bottom - record[metric] / ceiling * (bottom - top),
  }));
  const activePoint = points.find(p => p.record.short === active?.short);
  const dateStride = Math.max(1, Math.ceil(records.length * 48 / (right - left)));

  if (!active) return <p className="trend-empty">선택한 기간에 기록이 없어요.</p>;

  return <div className="trend-line-chart" ref={container}>
    <div className="trend-readout">
      <div><span className="trend-metric-name">{label}</span><strong>{active[metric].toLocaleString()}<small>{unit}</small></strong></div>
      <div className="trend-readout-date"><span>{active.date}</span><small>{records.length}회 수업 기록</small></div>
    </div>
    <svg viewBox={`0 0 ${width} 228`} role="group" aria-label={`수업별 ${label} 변화`} aria-describedby={descriptionId}>
      <desc id={descriptionId}>수업 순서대로 연결한 선 그래프입니다. 점에 마우스를 올리거나 키보드로 초점을 이동하면 위에 수치가 표시됩니다. 점을 선택하면 원본 기록을 엽니다.</desc>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#73977e" stopOpacity=".14"/><stop offset="100%" stopColor="#73977e" stopOpacity="0"/></linearGradient></defs>
      {[0, .5, 1].map(tick => {
        const y = bottom - tick * (bottom - top);
        return <g key={tick} aria-hidden="true">
          <line x1={left} x2={right} y1={y} y2={y} className="trend-grid"/>
          <text x={left - 16} y={y + 4} textAnchor="end" className="trend-tick">{(ceiling * tick).toLocaleString()}</text>
        </g>;
      })}
      {points.length > 1 && <g aria-hidden="true" pointerEvents="none">
        <path d={`M${points[0].x},${bottom} L${points.map(p => `${p.x},${p.y}`).join(' L')} L${points[points.length - 1].x},${bottom} Z`} fill={`url(#${gradientId})`}/>
        <polyline points={points.map(p => `${p.x},${p.y}`).join(' ')} className="trend-path" fill="none"/>
      </g>}
      {activePoint && <line x1={activePoint.x} x2={activePoint.x} y1={activePoint.y + 10} y2={bottom} className="trend-guide" aria-hidden="true"/>}
      {points.map(({record, x, y}, index) => <g
        key={record.short} className={`trend-point${active.short === record.short ? ' is-selected' : ''}`}
        role="button" tabIndex={0} aria-label={`${record.date}, ${record[metric].toLocaleString()}${unit}, 원본 기록 보기`}
        onMouseEnter={() => setHovered(record.short)} onMouseLeave={() => setHovered(null)}
        onFocus={() => setFocused(record.short)} onBlur={() => setFocused(null)}
        onClick={() => onSource(record.short)}
        onKeyDown={event => {if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); onSource(record.short);}}}
      >
        <circle cx={x} cy={y} r="18" className="trend-point-hit"/>
        <circle cx={x} cy={y} r="9" className="trend-point-halo"/>
        <circle cx={x} cy={y} r="4" className="trend-point-dot"/>
        {(index % dateStride === 0 || index === points.length - 1) && <text x={x} y="218" textAnchor="middle" className="trend-date">{record.short}</text>}
      </g>)}
    </svg>
    <p className="trend-help">{records.length === 1 ? '기록이 1회라 점으로 표시했어요. 다음 기록부터 선으로 이어집니다.' : '점에 마우스를 올리면 수치 확인 · 클릭하면 원본 보기'}</p>
  </div>;
}
