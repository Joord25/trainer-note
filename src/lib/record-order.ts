type DatedRow={input:{date:string;sourcePage:number};sessionIndex?:number};
type RecordGroup={id:string;rows:DatedRow[];data?:{unparsed:{page:number}[];status:string}};
// Sort sessions globally, including dates that overlap across different files/pages.
// Keep exercise order and source coordinates unchanged for editing and original navigation.
export function orderedRecordSessions<T extends RecordGroup>(groups:T[],extraPages:{fileId:string;page:number}[]=[]){
 const entries=groups.flatMap(group=>{
  const pages=[...new Set([...group.rows.map(r=>r.input.sourcePage||1),...(group.data?.unparsed.map(r=>r.page)||[]),...extraPages.filter(p=>p.fileId===group.id).map(p=>p.page)])].sort((a,b)=>a-b);
  if(!pages.length)pages.push(1);
  return pages.flatMap(page=>{
   const sessions=[...new Set(group.rows.filter(r=>(r.input.sourcePage||1)===page).map(r=>`${r.input.date}|${r.sessionIndex??''}`))];
   if(!sessions.length)sessions.push('|');
   return sessions.map(session=>({group,pages,page,session,date:session.split('|')[0],renderSession:session!=='|'||!['error','limited'].includes(group.data?.status??'')}));
  });
 });
 const dateKey=(date:string)=>/^\d{4}-\d{2}-\d{2}$/.test(date)?date:'';
 entries.sort((a,b)=>dateKey(b.date).localeCompare(dateKey(a.date)));
 const files=new Set<string>(),pages=new Set<string>();
 return entries.map(entry=>{
  const pageKey=`${entry.group.id}:${entry.page}`,firstForFile=!files.has(entry.group.id),firstForPage=!pages.has(pageKey);
  files.add(entry.group.id);pages.add(pageKey);
  return {...entry,firstForFile,firstForPage};
 });
}
