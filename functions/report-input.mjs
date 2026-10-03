import {compactChatFacts} from './chat.mjs';

// Request-local references avoid repeating long database IDs in every schema
// enum, metric and record. Restore references before normal ownership validation.
export function prepareReportInput(facts,schema){
 const ids=[...new Set(facts.records.map(r=>r.id))];
 const aliases=new Map(ids.map((id,i)=>[id,`record_${i+1}`]));
 // Do not alias an input that already uses an alias as a real ID.
 if(ids.some(id=>[...aliases.values()].includes(id)))aliases.clear();
 const originals=new Map([...aliases].map(([id,alias])=>[alias,id]));
 const map=(value,dictionary)=>{
  if(typeof value==='string')return dictionary.get(value)??value;
  if(Array.isArray(value))return value.map(v=>map(v,dictionary));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,map(v,dictionary)]));
  return value;
 };
 const compact=compactChatFacts(facts);
 return {facts:map(compact,aliases),schema:map(schema,aliases),restore:value=>{
  // Only reference fields are decoded; model-written prose remains untouched.
  const restoreReferences=value=>{
   if(Array.isArray(value))return value.map(restoreReferences);
   if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,['recordId','evidenceIds'].includes(k)?map(v,originals):restoreReferences(v)]));
   return value;
  };
  return restoreReferences(value);
 }};
}

// Lossless transport fallback: a table includes explicit columns, with every
// input row and cell retained. Mixed object shapes remain ordinary JSON.
export function tabulateReportFacts(value){
 if(Array.isArray(value)){
  const rows=value.map(tabulateReportFacts);
  if(rows.length>1&&value.every(v=>v&&typeof v==='object'&&!Array.isArray(v))){
   const columns=Object.keys(value[0]);
   if(columns.length&&value.every(v=>Object.keys(v).length===columns.length&&columns.every(k=>Object.hasOwn(v,k))))
    return {columns,rows:rows.map(v=>columns.map(k=>v[k]))};
  }
  return rows;
 }
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,tabulateReportFacts(v)]));
 return value;
}
export const REPORT_TABLE_INSTRUCTION='입력의 {columns,rows}는 원본 객체 배열을 표로 표현한 것이다. 각 rows 행의 값은 columns의 필드 순서와 대응한다. 모든 행과 날짜를 분석하며 null과 0을 구분한다.';
