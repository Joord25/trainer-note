// Match a whole trainer-authored label; never match substrings or transfer doses.
export const aliasKey=value=>typeof value==='string'?value.normalize('NFKC').toLowerCase().replace(/[\s.]/g,''):'';
export function aliasCorrection(before,after){
 const alias=before?.rawName?.trim(),name=after?.exerciseName?.trim();
 if(!alias||!name||name.length>100||alias.length>100||name===before.exerciseName?.trim()||aliasKey(alias)===aliasKey(name))return null;
 return {alias,exerciseName:name};
}
export function applyExerciseAliases(value,rules){
 const aliases=new Map(rules.filter(r=>r.nameAlias===true).map(r=>[aliasKey(r.alias),r.exerciseName]));
 const apply=row=>{if(!row||typeof row!=='object')return row;const name=aliases.get(aliasKey(row.rawName));return {...row,...(name?{exerciseName:name}:{}),...(Array.isArray(row.components)?{components:row.components.map(apply)}:{})};};
 return value&&Array.isArray(value.records)?{...value,records:value.records.map(apply)}:value;
}
