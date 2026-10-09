import {FieldValue} from 'firebase-admin/firestore';

export const USAGE_REPORT_LIMIT=10000;
export const usageMonth=now=>new Date(now+9*3600000).toISOString().slice(0,7);
const validPurpose=value=>['production','development'].includes(value);
const number=value=>Number.isFinite(value)&&value>=0?value:0;
const groups={extraction:['extraction','원본 판독'],'analysis-and-plan':['analysis','기록 분석'],'member-changes':['analysis','기록 분석'],'goal-visual':['analysis','기록 분석'],'assessment-review':['assessment','평가·목표'],'assessment':['assessment','평가·목표'],'goal-design':['assessment','평가·목표'],'cycle-plan':['planning','수업 계획'],'connected-lesson':['planning','수업 계획'],'direction-discussion':['discussion','방향 논의'],'search-safety':['search','웹 검색·안전 확인'],'assistant-web-search':['search','웹 검색·안전 확인']};
function group(call){
 if(call.kind==='assistant-chat')return call.model==='gemini-3.5-flash-lite'?['chat-deep','AI 도우미 · 심층']:call.model==='gemini-3.1-flash-lite'?['chat-quick','AI 도우미 · 기본']:['chat-other','AI 도우미 · 이전/기타'];
 return groups[call.kind]??['other','기타'];
}
const empty=()=>({calls:0,settledCalls:0,completedCalls:0,failedCalls:0,pendingCalls:0,usedMicros:0,reservedMicros:0,inputTokens:0,outputTokens:0,uncertainCalls:0,uncertainMicros:0,searchMicros:0,durationMs:0,timedCalls:0});
export function summarizeUsage(calls,{purpose='all'}={}){
 const rows=new Map(),totals=empty(),sources={production:empty(),development:empty(),unclassified:empty()};
 const add=(stats,c)=>{
  stats.calls++;
  if(c.status==='reserved'){stats.pendingCalls++;stats.reservedMicros+=number(c.reservedMicros);return;}
  if(!['complete','failed'].includes(c.status))return;
  stats.settledCalls++;stats[c.status==='complete'?'completedCalls':'failedCalls']++;
  stats.usedMicros+=number(c.estimatedMicros);stats.inputTokens+=number(c.inputTokens);stats.outputTokens+=number(c.outputTokens);stats.searchMicros+=number(c.searchEstimatedMicros);
  if(c.usageUncertain){stats.uncertainCalls++;stats.uncertainMicros+=number(c.estimatedMicros);}
  if(Number.isFinite(c.durationMs)&&c.durationMs>=0){stats.timedCalls++;stats.durationMs+=c.durationMs;}
 };
 for(const c of calls){const source=validPurpose(c.purpose)?c.purpose:'unclassified';add(sources[source],c);if(purpose!=='all'&&purpose!==source)continue;const [id,label]=group(c);if(!rows.has(id))rows.set(id,{id,label,...empty()});add(rows.get(id),c);add(totals,c);}
 const finish=stats=>({...stats,averageMicros:stats.settledCalls?stats.usedMicros/stats.settledCalls:null,averageDurationMs:stats.timedCalls?stats.durationMs/stats.timedCalls:null});
 return {totals:finish(totals),sources:Object.fromEntries(Object.entries(sources).map(([key,value])=>[key,finish(value)])),rows:[...rows.values()].map(finish).sort((a,b)=>b.usedMicros-a.usedMicros||b.calls-a.calls||a.id.localeCompare(b.id))};
}
export function createUsageReporting({db,auth,now=()=>Date.now(),limit=USAGE_REPORT_LIMIT}){
 function validateMonth(month){const current=usageMonth(now());if(typeof month!=='string'||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))throw Error('조회할 월을 확인해주세요.');const serial=m=>Number(m.slice(0,4))*12+Number(m.slice(5));if(serial(month)>serial(current)||serial(current)-serial(month)>23)throw Error('최근 24개월 내 사용량을 선택해주세요.');return month;}
 async function report(uid,input={},{project=false}={}){
  const month=validateMonth(input.month??usageMonth(now())),purpose=input.purpose??'all';
  if(!['all','production','development','unclassified'].includes(purpose))throw Error('사용 구분을 확인해주세요.');
  const calls=project?db.collectionGroup('aiCalls'):db.collection(`trainers/${uid}/aiCalls`);
  const global=db.doc(`aiGlobalUsage/${month}`);
  const [logs,monthly,settings,shards]=await Promise.all([calls.where('month','==',month).limit(limit+1).get(),(project?global:db.doc(`trainers/${uid}/aiUsage/${month}`)).get(),db.doc(`trainers/${uid}/usageSettings/current`).get(),project?global.collection('shards').get():null]);
  const values=logs.docs.slice(0,limit).filter(d=>!project||/^trainers\/[^/]+\/aiCalls\/[^/]+$/.test(d.ref.path)).map(d=>d.data()),all=summarizeUsage(values),summary=monthly.data()??{};
  if(project)for(const shard of shards.docs){summary.usedMicros=number(summary.usedMicros)+number(shard.data().usedMicros);summary.reservedMicros=number(summary.reservedMicros)+number(shard.data().reservedMicros);}
  // Derive ownership from the ledger path, never a field supplied by a caller.
  const accounts=[];
  let accountNamesUnavailable=false;
  if(project){
   const byOwner=new Map();
   for(const doc of logs.docs.slice(0,limit)){
    const match=/^trainers\/([^/]+)\/aiCalls\/[^/]+$/.exec(doc.ref.path);
    if(!match)continue;
    if(!byOwner.has(match[1]))byOwner.set(match[1],[]);
    byOwner.get(match[1]).push(doc.data());
   }
   const identities=new Map(),owners=[...byOwner.keys()];
   if(auth)for(let i=0;i<owners.length;i+=100){
    try{const result=await auth.getUsers(owners.slice(i,i+100).map(uid=>({uid})));for(const user of result.users)identities.set(user.uid,user);}
    catch{accountNamesUnavailable=true;}
   }
   for(const [uid,calls] of byOwner){
    const identity=identities.get(uid);
    accounts.push({uid,displayName:identity?.displayName??null,email:identity?.email??null,breakdowns:Object.fromEntries(['all','production','development','unclassified'].map(p=>{const {totals,rows}=summarizeUsage(calls,{purpose:p});return [p,{totals,rows}];}))});
   }
   accounts.sort((a,b)=>b.breakdowns.all.totals.usedMicros-a.breakdowns.all.totals.usedMicros||a.uid.localeCompare(b.uid));
  }
  return {accounts,accountNamesUnavailable,scope:project?'project':'account',month,purpose,...summarizeUsage(values,{purpose}),breakdowns:Object.fromEntries(['all','production','development','unclassified'].map(p=>{const {totals,rows}=summarizeUsage(values,{purpose:p});return [p,{totals,rows}];})),trackingPurpose:validPurpose(settings.data()?.purpose)?settings.data().purpose:'production',partial:logs.size>limit,scannedCalls:values.length,limit,monthly:{calls:project?null:number(summary.calls),usedMicros:number(summary.usedMicros),reservedMicros:number(summary.reservedMicros)},unattributedMicros:Math.max(0,number(summary.usedMicros)-all.totals.usedMicros),unattributedCalls:project?0:Math.max(0,number(summary.calls)-all.totals.calls),asOf:new Date(now()).toISOString()};
 }
 async function setPurpose(uid,input={}){if(!validPurpose(input.purpose))throw Error('실사용 또는 개발·테스트를 선택해주세요.');await db.doc(`trainers/${uid}/usageSettings/current`).set({purpose:input.purpose,updatedAt:FieldValue.serverTimestamp()});return {purpose:input.purpose};}
 return {report,setPurpose};
}
