// Read-only aggregate report for beta usage review. Never prints questions,
// member records, captures or individual call IDs. Uses operator ADC credentials.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault,deleteApp}=require('firebase-admin/app');
const {getFirestore,FieldPath}=require('firebase-admin/firestore');
const [projectId,uid,month]=process.argv.slice(2);
if(!projectId||!/^[-_a-zA-Z0-9]{1,128}$/.test(uid??'')||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month??''))throw Error('Usage: node scripts/summarize-ai-usage.mjs PROJECT UID YYYY-MM');
const app=initializeApp({credential:applicationDefault(),projectId});
try{
 const query=getFirestore(app).collection(`trainers/${uid}/aiCalls`).where('month','==',month).orderBy(FieldPath.documentId());
 const groups=new Map();let cursor,count=0;
 for(;;){const page=await (cursor?query.startAfter(cursor):query).limit(500).get();if(page.empty)break;
  for(const doc of page.docs){const c=doc.data(),key=c.kind??'unknown';if(!groups.has(key))groups.set(key,{attempts:0,complete:0,failed:0,unsettled:0,inputTokens:0,outputTokens:0,estimatedMicros:0,uncertain:0,durations:[]});const g=groups.get(key);g.attempts++;count++;g.complete+=c.status==='complete'?1:0;g.failed+=c.status==='failed'?1:0;g.unsettled+=c.status==='reserved'?1:0;g.inputTokens+=c.inputTokens??0;g.outputTokens+=c.outputTokens??0;g.estimatedMicros+=c.estimatedMicros??0;g.uncertain+=c.usageUncertain?1:0;if(Number.isFinite(c.durationMs)&&c.durationMs>0)g.durations.push(c.durationMs);}
  cursor=page.docs.at(-1);if(page.size<500)break;
 }
 const report=Object.fromEntries([...groups].map(([kind,{durations,...g}])=>{durations.sort((a,b)=>a-b);return [kind,{...g,averageInputTokens:Math.round(g.inputTokens/Math.max(1,g.complete+g.failed)),estimatedUsd:g.estimatedMicros/1e6,durationSamples:durations.length,medianMs:durations.length?durations[Math.floor(durations.length/2)]:null,p95Ms:durations.length?durations[Math.ceil(durations.length*.95)-1]:null}];}));
 console.log(JSON.stringify({month,callCount:count,byKind:report,note:'App-account API attempts, not user questions or Google invoices. Old calls may lack latency data.'},null,2));
}finally{await deleteApp(app);}
