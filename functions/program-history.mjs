import {isCardioWorkout} from './generated/cardio-distribution.mjs';
import {exerciseGroups} from './generated/progress-analysis.mjs';
import {measurementType} from './generated/workout-measurements.mjs';

// The import row array is the same source order used by the record editor.
// Firestore document IDs and dates alone do not encode exercise order.
export function programHistory(rows,imports=[],candidates=[]){
 const order=new Map(),compound=new Map();
 for(const file of imports)for(const [index,row] of (file.rows??[]).entries()){
  order.set(row.id,index);if(row.compound)compound.set(row.id,row.compound);
 }
 const candidateFor=new Map();
 for(const group of exerciseGroups(rows)){
  const candidate=candidates.find(c=>c.evidence?.some(e=>e.tab==='trend'&&e.key===group.key));
  if(candidate)for(const row of group.records)candidateFor.set(row.id,candidate.id);
 }
 const dates=[...new Set(rows.map(r=>r.date))].sort();
 const sessions=dates.map(date=>{
  const day=rows.filter(r=>r.date===date),sources=new Map();
  for(const row of day){const key=JSON.stringify([row.sourceHash??'',row.sourcePage??0]);if(!sources.has(key))sources.set(key,[]);sources.get(key).push(row);}
  const blocks=[...sources.values()].sort((a,b)=>(a[0].sourceHash??'').localeCompare(b[0].sourceHash??'')||(a[0].sourcePage??0)-(b[0].sourcePage??0)).map(block=>{
   const ordered=[...block].sort((a,b)=>(order.get(a.id)??Infinity)-(order.get(b.id)??Infinity)||a.id.localeCompare(b.id));
   return {sourceName:ordered[0].sourceName??'',page:ordered[0].sourcePage??0,orderKnown:ordered.every(r=>order.has(r.id)),exercises:ordered.map(r=>({recordId:r.id,candidateId:candidateFor.get(r.id)??'',name:r.exerciseName,bodyPart:r.bodyPart,segments:r.sets.length,kind:measurementType(r),...(compound.has(r.id)?{compound:compound.get(r.id)}:{})}))};
  });
  return {date,exerciseCount:day.length,strengthSets:day.filter(r=>measurementType(r)==='repetitions'&&!isCardioWorkout(r)).reduce((n,r)=>n+r.sets.length,0),cardioSegments:day.filter(isCardioWorkout).reduce((n,r)=>n+r.sets.length,0),blocks};
 });
 const pairs=new Map();
 for(const session of sessions){const names=[...new Set(session.blocks.flatMap(b=>b.exercises.map(e=>e.name)))].sort();for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){const key=JSON.stringify([names[i],names[j]]);pairs.set(key,(pairs.get(key)??0)+1);}}
 return {sessions,patterns:{sessionCount:sessions.length,exerciseCountRange:sessions.length?[Math.min(...sessions.map(s=>s.exerciseCount)),Math.max(...sessions.map(s=>s.exerciseCount))]:[],averageStrengthSets:sessions.length?Math.round(sessions.reduce((n,s)=>n+s.strengthSets,0)/sessions.length*10)/10:0,recurringPairs:[...pairs].filter(([,count])=>count>=2).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,8).map(([names,count])=>({exercises:JSON.parse(names),sessions:count}))}};
}
