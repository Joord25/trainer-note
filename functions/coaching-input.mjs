// Application budget, independent of the legacy report budget. No record slicing.
export const COACHING_INPUT_TOKENS=262144;
export function compactCoachingFacts(facts){
 const records=new Map(facts.records.map(r=>[r.id,r]));
 return {...facts,evidence:facts.evidence.map(e=>({...e,...(e.points?{points:e.points.map(p=>{
  // Remove only redundant copies that can be recovered from referenced records.
  if(!p.recordIds?.length||!p.recordIds.every(id=>records.has(id)))return p;
  const rows=p.recordIds.map(id=>records.get(id));
  const conditions=rows.map(r=>({loadType:r.loadType,measurementType:r.measurementType??'repetitions',sets:r.sets,notes:r.notes??'',trainerNote:r.trainerNote??''}));
  if(JSON.stringify(p.sets)!==JSON.stringify(rows.flatMap(r=>r.sets))||JSON.stringify(p.conditions)!==JSON.stringify(conditions))return p;
  const {sets,conditions:duplicate,...point}=p;return point;
 })}:{})}))};
}
