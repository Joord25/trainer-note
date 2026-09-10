import {Insights} from './workout-insights';
import {Icon} from './icons';
export function InsightReport({stats,goal,period,review,onSource,onProgram}:{stats:Insights;goal:string;period:string;review:string;onSource:(date:string)=>void;onProgram:()=>void}){
 const top=stats.top;
 const squatNames=stats.parts.find(p=>p.id==='legs')?.exercises||[];
 const mixedSquats=squatNames.includes('BB sq')&&squatNames.length>1;
 return <section className="insight-report"><div className="report-heading"><span className="report-icon"><Icon name="spark" size={19}/></span><div><h2>AI 종합 의견</h2><span>예시 해석 · 실제 AI 생성 전</span></div><span className="report-version">REPORT / 01</span></div>
 <div className="report-context"><span>{period==='전체'?'6–8월':period}</span><span>{stats.sessionCount}회 수업</span><span>{stats.totalSets}세트</span></div>
 <h3>비중을 맞추기보다,<br/>같은 조건의 변화를 먼저 봐요.</h3>
 <p>선택한 예시 기록에서 <b>{top.label} 운동이 {top.sets}세트({top.percent}%)</b>로 가장 큰 비중을 차지해요. 이 분포만으로 다른 부위가 부족하다거나 특정 부위의 회복이 필요하다고 판단하지는 않았어요.</p>
 <div className="report-block"><span className="report-label">목표와 연결</span><p>목표는 ‘{goal}’입니다. 총세트 증가보다 <b>같은 동작·기구·수행 조건에서의 변화</b>를 확인할 수 있는 기록이 우선이에요.</p></div>
 <div className="report-block"><span className="report-label">해석을 보류한 부분</span><p>{mixedSquats?(review==='다른 운동으로 분리'?'스쿼트 종류를 분리했으므로 서로 다른 동작의 중량을 직접 비교하지 않아요.':'스쿼트 표기가 달라 동작과 기구 확인 전에는 중량 변화를 발전으로 단정하지 않았어요.'):'현재 선택된 기간의 기록만으로 장기적인 목표 달성 여부를 단정하지 않았어요.'} 기록에 수행 노력과 컨디션이 없어 고·중·저 강도도 확정하지 않았습니다.</p></div>
 <div className="report-evidence"><span>분포 근거</span>{top.sessionDates.map(d=><button key={d} onClick={()=>onSource(d)}>{d}<Icon name="file" size={12}/></button>)}</div>
 <div className="report-conclusion"><span className="report-label">다음 수업의 방향</span><p>최근 수업의 구성을 출발점으로 삼고, 기준 동작과 오늘 컨디션을 확인하는 프로그램 초안을 준비했어요.</p></div>
 <button className="primary wide" onClick={onProgram}>이 의견으로 수업 준비 <Icon name="arrow" size={16}/></button>
 </section>
}
