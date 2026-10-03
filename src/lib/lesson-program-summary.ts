import type {SourceRow} from '../components/analysis-source';
const upper=['가슴','등','어깨','이두','삼두'];
const ordered=[...upper,'하체','코어','전신','유산소','미분류'];
export function lessonDates(rows:SourceRow[],today:string){
 return [...new Set(rows.map(row=>row.input.date).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=today&&Number.isFinite(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date))].sort().reverse();
}
export function lessonProgramSummary(rows:SourceRow[]){
 const groups=ordered.map(part=>({part,names:[...new Set(rows.filter(row=>(ordered.includes(row.input.bodyPart)?row.input.bodyPart:'미분류')===part).map(row=>row.input.exerciseName||row.input.rawName||'운동명 확인 필요'))]})).filter(group=>group.names.length);
 const parts=groups.map(group=>group.part),main=parts.filter(part=>upper.includes(part)||part==='하체'||part==='전신');
 const title=parts.includes('전신')||parts.includes('하체')&&parts.some(part=>upper.includes(part))?'상·하체 함께':main.length?`${main.join('·')} 중심`:parts.length?`${parts.join('·')} 구성`:'운동 구성 확인 필요';
 return {groups,title,signature:main.join('|'),uncertain:rows.some(row=>row.review==='needs-review')||parts.includes('미분류')};
}
// A candidate requires two complete, identical ordered cycles, not just N body parts.
export function splitPatternCandidate(rows:SourceRow[],today:string){
 const sessions=lessonDates(rows,today).slice(0,20).reverse().map(date=>({date,...lessonProgramSummary(rows.filter(row=>row.input.date===date))}));
 for(const count of [2,3,4,5]){
  const recent=sessions.slice(-count*2);if(recent.length!==count*2||recent.some(s=>s.uncertain||!s.signature||s.signature.includes('전신')))continue;
  const first=recent.slice(0,count),second=recent.slice(count);
  if(new Set(first.map(s=>s.signature)).size!==count||!first.every((session,index)=>session.signature===second[index].signature))continue;
  return {count,from:recent[0].date,to:recent.at(-1)!.date,sequence:second.map(s=>s.signature.split('|').join('·'))};
 }
 return null;
}
