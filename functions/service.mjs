import {CHAT_VERSION,CHAT_PROMPT,validateChatRequest,chatSchema,validateChatAnswer} from './chat.mjs';
import {evaluateJudgment,selectCases,validateCriteria,modelJudgmentContext,judgmentResponseSchema,judgmentDate} from './judgment.mjs';
import {randomUUID} from 'node:crypto';
import {FieldValue,Timestamp} from 'firebase-admin/firestore';
import {parseExtraction,EXTRACTION_PROMPT,EXTRACTION_SCHEMA,EXTRACTION_VERSION} from './generated/extraction.mjs';
import {MODEL,REPORT_VERSION,PRICE_VERSION,LIMITS,hash,costMicros,classify,summarize,reportFingerprint,REPORT_PROMPT,REPORT_SCHEMA,validateReport,validInput,openApiSchema} from './domain.mjs';
const stamp=()=>FieldValue.serverTimestamp();
const dateKeys=now=>{const d=new Date(now+9*3600000).toISOString().slice(0,10);return {month:d.slice(0,7),day:d};};
export function createService({db,readSource,model,enqueue,now=()=>Date.now(),limits=LIMITS}){
 const memberRef=(uid,mid)=>db.doc(`trainers/${uid}/members/${mid}`);
 async function recordsFor(member){const snap=await member.collection('records').orderBy('performedAt','desc').limit(limits.maxRecords).get();return snap.docs.map(d=>{const v=d.data();return {...v,id:d.id,date:v.performedAt.toDate().toISOString().slice(0,10)};});}
 async function paid(uid,kind,request,maxOutputTokens){
  const key=randomUUID(),dates=dateKeys(now()),usage=db.doc(`trainers/${uid}/aiUsage/${dates.month}`),daily=db.doc(`trainers/${uid}/aiDaily/${dates.day}`),global=db.doc(`aiGlobalUsage/${dates.month}`),call=db.doc(`trainers/${uid}/aiCalls/${key}`),reserve=costMicros(limits.maxInputTokens,maxOutputTokens);
  await db.runTransaction(async tx=>{
   const [u,d,g]=await tx.getAll(usage,daily,global),uv=u.data()||{},dv=d.data()||{},gv=g.data()||{};
   if((uv.usedMicros||0)+(uv.reservedMicros||0)+reserve>limits.monthlyMicros||(dv.calls||0)>=limits.dailyCalls||(gv.usedMicros||0)+(gv.reservedMicros||0)+reserve>limits.globalMonthlyMicros)throw Error('AI_USAGE_LIMIT:무료 베타 AI 이용 한도에 도달했어요. 저장된 결과는 계속 볼 수 있어요.');
   tx.set(usage,{reservedMicros:(uv.reservedMicros||0)+reserve,calls:(uv.calls||0)+1,monthlyLimitMicros:limits.monthlyMicros,dailyLimit:limits.dailyCalls,priceVersion:PRICE_VERSION,updatedAt:stamp()},{merge:true});
   tx.set(daily,{calls:(dv.calls||0)+1,updatedAt:stamp()},{merge:true});tx.set(global,{reservedMicros:(gv.reservedMicros||0)+reserve,updatedAt:stamp()},{merge:true});
   tx.create(call,{kind,model:MODEL,status:'reserved',reservedMicros:reserve,month:dates.month,createdAt:stamp(),priceVersion:PRICE_VERSION});
  });
  let result,error;try{result=await model({...request,maxOutputTokens,maxInputTokens:limits.maxInputTokens});}catch(e){error=e;}
  const usageData=result?.usage??error?.usage,known=Number.isInteger(usageData?.inputTokens)&&Number.isInteger(usageData?.outputTokens)&&usageData.inputTokens>=0&&usageData.outputTokens>=0,actual=known?costMicros(usageData.inputTokens,usageData.outputTokens):error?.notBillable?0:reserve;
  await db.runTransaction(async tx=>{const [c,u,g]=await tx.getAll(call,usage,global);if(c.data()?.status!=='reserved')return;const uv=u.data()||{},gv=g.data()||{};
   tx.update(usage,{reservedMicros:Math.max(0,(uv.reservedMicros||0)-reserve),usedMicros:(uv.usedMicros||0)+actual,inputTokens:(uv.inputTokens||0)+(usageData?.inputTokens||0),outputTokens:(uv.outputTokens||0)+(usageData?.outputTokens||0),updatedAt:stamp()});
   tx.update(global,{reservedMicros:Math.max(0,(gv.reservedMicros||0)-reserve),usedMicros:(gv.usedMicros||0)+actual,updatedAt:stamp()});
   tx.update(call,{status:error?'failed':'complete',inputTokens:usageData?.inputTokens??null,outputTokens:usageData?.outputTokens??null,estimatedMicros:actual,usageUncertain:!known&&!error?.notBillable,finishedAt:stamp()});
  });
  if(error)throw error;return {...result,usage:{...usageData,estimatedMicros:actual,callId:key,priceVersion:PRICE_VERSION}};
 }
 async function scheduleReport(uid,mid){
  const member=memberRef(uid,mid),ref=member.collection('analysis').doc('current');let queued=false;
  await db.runTransaction(async tx=>{queued=false;const [m,a]=await tx.getAll(member,ref);if(!m.exists)return;const old=a.data();if(old?.status==='queued'&&old.queuedAt?.toMillis()>now()-25000)return;
   tx.set(ref,{status:'queued',queuedAt:Timestamp.fromMillis(now()),updatedAt:stamp()},{merge:true});queued=true;});
  if(queued)try{await enqueue({uid,memberId:mid},randomUUID());}catch(e){await ref.set({status:'error',error:'분석 대기열에 연결하지 못했어요. 다시 시도해주세요.',updatedAt:stamp()},{merge:true});throw e;}
 }
 async function storeRows(uid,mid,fileId,job,raw,parsed,opts={}){
  const member=memberRef(uid,mid),ref=member.collection('imports').doc(fileId),history=await recordsFor(member);
  const rows=parsed.records.map(r=>classify(r,history,opts));
  await db.runTransaction(async tx=>{
   const [m,current,file]=await tx.getAll(member,ref,member.collection('files').doc(fileId));
   if(!m.exists||!file.exists||file.data().status!=='ready'||current.data()?.job!==job)throw Error('원본이나 판독 상태가 변경됐어요.');
   const old=current.data(),existingRows=new Map((old.rows||[]).map(r=>[r.id,r]));
   const merged=rows.map(r=>{const previous=existingRows.get(r.id);if(previous?.review==='confirmed'||previous?.review==='ignored')return previous;if(previous?.dateOverride){const next=classify({...r,input:{...r.input,date:previous.input.date},issues:r.issues.filter(i=>!i.includes('운동 날짜')&&!i.includes('원본에 연도가 없어 지정한'))},history,opts);return {...next,dateOverride:true};}return r;});
   for(const previous of existingRows.values())if(['confirmed','ignored'].includes(previous.review)&&!merged.some(r=>r.id===previous.id))merged.push(previous);
   const refs=merged.map(r=>member.collection('records').doc(r.id)),existing=refs.length?await tx.getAll(...refs):[];let delta=0,lastId=m.data().lastRecordId||'';
   for(let i=0;i<merged.length;i++){
    const r=merged[i],saved=existing[i].data();
    if(saved?.status==='confirmed'){
     const {performedAt,rawName,exerciseName,bodyPart,loadType,sets,sourceName,sourceHash,sourcePage,notes}=saved;
     r.input={date:performedAt.toDate().toISOString().slice(0,10),rawName,exerciseName,bodyPart,loadType,sets,sourceName,sourceHash,sourcePage,notes};r.review='confirmed';r.issues=[];continue;
    }
    if(r.review!=='auto'){if(saved?.origin==='ai-auto'&&saved.status==='provisional'){tx.delete(refs[i]);delta--;lastId=r.id;}continue;}
    const {date,...input}=validInput(r.input),fields={...input,performedAt:Timestamp.fromDate(new Date(date+'T12:00:00Z')),origin:'ai-auto',status:'provisional',revision:(saved?.revision||0)+1,updatedAt:stamp()};
    if(saved){tx.update(refs[i],fields);}else{tx.create(refs[i],{...fields,createdAt:stamp()});delta++;lastId=r.id;}
   }
   if((m.data().recordCount||0)+delta>5000)throw Error('회원 기록 한도에 도달했어요.');
   if(delta)tx.update(member,{recordCount:(m.data().recordCount||0)+delta,lastRecordId:lastId,updatedAt:stamp()});
   const state={raw,rows:merged,unparsed:parsed.unparsed.filter(v=>!(old.resolvedUnparsed||[]).includes(hash(v))),status:'ready',revision:(old.revision||0)+1,year:opts.year??null,memberConfirmed:!!opts.memberConfirmed,error:'',updatedAt:stamp()};
   if(Buffer.byteLength(JSON.stringify(state))>700000)throw Error('판독 결과가 너무 커요. 파일을 나눠주세요.');tx.update(ref,state);
  });
  await scheduleReport(uid,mid);
 }
 async function startImport(uid,mid,fileId,retry=false){
  const member=memberRef(uid,mid),ref=member.collection('imports').doc(fileId),job=randomUUID();let source,memberData,claimed=false;
  await db.runTransaction(async tx=>{claimed=false;const [m,f,i]=await tx.getAll(member,member.collection('files').doc(fileId),ref);
   if(!m.exists||!f.exists||f.data().status!=='ready')throw Error('저장 완료된 회원 원본 파일을 선택해주세요.');
   const old=i.data();if(old?.status==='ready')return;if(old?.status==='processing'&&old.startedAt?.toMillis()>now()-180000)return;
   if(old&&!retry)return;
   source={id:fileId,...f.data()};memberData=m.data();if(source.size>10*1024*1024){tx.set(ref,{status:'error',name:source.name,rows:[],unparsed:[],revision:0,error:'자동 판독은 파일당 10MB까지 가능해요. 파일을 나눠주세요.',updatedAt:stamp()});return;}
   tx.set(ref,{status:'processing',job,model:MODEL,promptVersion:EXTRACTION_VERSION,name:source.name,contentType:source.contentType,revision:old?.revision||0,rows:old?.rows||[],unparsed:old?.unparsed||[],startedAt:Timestamp.fromMillis(now()),updatedAt:stamp(),error:''},{merge:true});claimed=true;
  });
  if(!claimed)return {cached:true};
  try{
   const data=await readSource(uid,mid,source);
   const result=await paid(uid,'extraction',{system:EXTRACTION_PROMPT+'\n응답 전에 날짜·단위·각 세트의 대응을 원본과 다시 대조하고, 애매한 점은 issues에 한국어로 기록한다.',schema:openApiSchema(EXTRACTION_SCHEMA),parts:[{text:'원본 기록을 판독하고 자체 점검한 결과만 반환해주세요.'},{inlineData:{mimeType:source.contentType,data}}]},limits.extractOutputTokens);
   await ref.update({usage:result.usage});
   const year=Number(dateKeys(now()).day.slice(0,4));const parsed=await parseExtraction(result.value,source,memberData.name,year);await storeRows(uid,mid,fileId,job,result.value,parsed,{year,yearConfirmed:true});
   return {cached:false};
  }catch(e){await db.runTransaction(async tx=>{const current=await tx.get(ref);if(current.data()?.job===job)tx.update(ref,{status:String(e.message).startsWith('AI_USAGE_LIMIT')?'limited':'error',error:safeError(e),updatedAt:stamp()});});await scheduleReport(uid,mid);return {error:safeError(e)};}
 }
 async function reviewImport(uid,mid,fileId,request){
  const member=memberRef(uid,mid),ref=member.collection('imports').doc(fileId),[snap,m]=await Promise.all([ref.get(),member.get()]);const data=snap.data();
  if(!m.exists||data?.status!=='ready'||data.revision!==request.revision)throw Error('판독 결과가 변경됐어요. 최신 화면에서 다시 확인해주세요.');
  if(request.operation==='year'||request.operation==='member'){
   const year=request.operation==='year'?request.year:data.year;
   if(year!==null&&year!==undefined&&(!Number.isInteger(year)||year<1900||year>2100))throw Error('올바른 연도를 입력해주세요.');
   const memberConfirmed=request.operation==='member'?true:data.memberConfirmed;
   const parsed=await parseExtraction(data.raw,{id:fileId,name:data.name,contentType:data.contentType},m.data().name,year??undefined);
   // Revision fence before the bulk correction; no Gemini call for year/member fixes.
   const job=randomUUID();await db.runTransaction(async tx=>{const cur=await tx.get(ref);if(cur.data()?.revision!==request.revision)throw Error('다른 화면에서 수정됐어요.');tx.update(ref,{job});});
   await storeRows(uid,mid,fileId,job,data.raw,parsed,{year,yearConfirmed:!!year,memberConfirmed});return;
  }
  if(request.operation==='date'){
   const date=request.date,page=request.page,d=new Date(date+'T12:00:00Z');
   if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==date||date<'1900-01-01'||date>'2100-12-31'||!Number.isInteger(page)||page<1||page>10000)throw Error('날짜와 페이지를 확인해주세요.');
   await db.runTransaction(async tx=>{
    const [cur,parent,file]=await tx.getAll(ref,member,member.collection('files').doc(fileId));
    if(!parent.exists||file.data()?.status!=='ready'||cur.data()?.revision!==request.revision)throw Error('다른 화면에서 수정됐어요.');
    if(file.data().contentType!=='application/pdf'&&page!==1)throw Error('이미지는 1쪽만 적용할 수 있어요.');
    const saved=await tx.get(member.collection('records').where('sourceHash','==',fileId));
    const onPage=saved.docs.filter(d=>d.data().sourcePage===page),byId=new Map(onPage.map(d=>[d.id,d]));
    const rows=cur.data().rows.map(r=>({...r})),targets=rows.filter(r=>r.input.sourcePage===page&&r.review!=='ignored');
    if(!targets.length&&!onPage.length)throw Error('이 페이지에 적용할 기록이 없어요.');
    if(new Set([...targets.map(r=>r.id),...onPage.map(r=>r.id)]).size>240)throw Error('한 페이지에 기록이 너무 많아요. 나누어 수정해주세요.');
    const missing=targets.filter(r=>!byId.has(r.id));const missingDocs=missing.length?await tx.getAll(...missing.map(r=>member.collection('records').doc(r.id))):[];
    if(missingDocs.some(d=>d.exists))throw Error('원본 연결이 변경된 기록이 있어요. 다시 확인해주세요.');
    let delta=0;const changes=[];
    for(const r of targets){const before=r.input;r.input={...r.input,date};r.dateOverride=true;changes.push({id:r.id,before,after:r.input});
     if(r.review!=='confirmed'){
      // Resolve date warnings only; unit, identity and ambiguous values stay pending.
      const issues=r.issues.filter(i=>!['연도를 포함한 운동 날짜를 확인해주세요.','원본에 연도가 없어 지정한'].some(v=>i.startsWith(v)));
      const next=classify({...r,issues});r.issues=next.issues;r.review=next.review;
     }
     r.revision=(r.revision||0)+1;
     if(!byId.has(r.id)&&(r.review==='auto'||r.review==='confirmed')){
      const {date:_,...fields}=validInput(r.input);tx.create(member.collection('records').doc(r.id),{...fields,performedAt:Timestamp.fromDate(d),origin:'ai-auto',status:r.review==='confirmed'?'confirmed':'provisional',revision:1,createdAt:stamp(),updatedAt:stamp()});delta++;
     }
    }
    for(const doc of onPage)tx.update(doc.ref,{performedAt:Timestamp.fromDate(d),revision:(doc.data().revision||0)+1,updatedAt:stamp()});
    if((parent.data().recordCount||0)+delta>5000)throw Error('회원 기록 한도에 도달했어요.');
    if(delta)tx.update(member,{recordCount:(parent.data().recordCount||0)+delta,updatedAt:stamp()});
    tx.update(ref,{rows,revision:request.revision+1,updatedAt:stamp()});
    tx.create(member.collection('corrections').doc(),{fileId,page,before:{dates:changes.map(c=>c.before.date)},after:{date},reason:'같은 페이지 날짜 일괄 적용',createdAt:stamp()});
   });await scheduleReport(uid,mid);return;
  }
  if(request.operation==='add'){
   const input=validInput(request.input),id=request.rowId;
   if(typeof id!=='string'||!/^[a-zA-Z0-9]{20}$/.test(id)||input.sourceHash!==fileId||input.sourceName!==data.name)throw Error('원본 연결을 확인해주세요.');
   await db.runTransaction(async tx=>{
    const record=member.collection('records').doc(id),[cur,parent,file,old]=await tx.getAll(ref,member,member.collection('files').doc(fileId),record);
    if(!parent.exists||file.data()?.status!=='ready'||cur.data()?.revision!==request.revision||old.exists)throw Error('다른 화면에서 수정됐어요. 최신 판독을 확인해주세요.');
    if(file.data().contentType!=='application/pdf'&&input.sourcePage!==1)throw Error('이미지는 1쪽만 기록할 수 있어요.');
    const v=cur.data(),unparsed=[...(v.unparsed||[])],resolvedUnparsed=[...(v.resolvedUnparsed||[])];
    if(request.unparsedIndex!==undefined){const i=request.unparsedIndex;if(!Number.isInteger(i)||i<0||i>=unparsed.length||unparsed[i].page!==input.sourcePage)throw Error('별도 원문이 변경됐어요.');resolvedUnparsed.push(hash(unparsed[i]));unparsed.splice(i,1);}
    if((parent.data().recordCount||0)>=5000||v.rows.length>=240)throw Error('기록 한도에 도달했어요.');
    const {date,...fields}=input;tx.create(record,{...fields,performedAt:Timestamp.fromDate(new Date(date+'T12:00:00Z')),status:'confirmed',origin:'ai-reviewed',revision:1,createdAt:stamp(),updatedAt:stamp()});
    tx.update(member,{recordCount:(parent.data().recordCount||0)+1,lastRecordId:id,updatedAt:stamp()});
    tx.update(ref,{rows:[...v.rows,{id,input,issues:[],memberName:parent.data().name,review:'confirmed',revision:1}],unparsed,resolvedUnparsed,revision:v.revision+1,updatedAt:stamp()});
    tx.create(member.collection('corrections').doc(),{fileId,rowId:id,before:request.unparsedIndex===undefined?null:v.unparsed[request.unparsedIndex],after:input,reason:'원본에서 운동 추가·판독 보완',createdAt:stamp()});
   });await scheduleReport(uid,mid);return;
  }
  if(request.operation!=='row'&&request.operation!=='ignore')throw Error('지원하지 않는 수정이에요.');
  const index=data.rows.findIndex(r=>r.id===request.rowId);if(index<0)throw Error('판독 항목이 없어요.');
  const before=data.rows[index],input=request.operation==='ignore'?before.input:validInput(request.input);
  if(input.sourceHash!==fileId||input.sourceName!==data.name)throw Error('원본 연결을 변경할 수 없어요.');
  await db.runTransaction(async tx=>{
   const record=member.collection('records').doc(before.id),[current,parent,oldRecord]=await tx.getAll(ref,member,record);
   if(!parent.exists||current.data()?.revision!==request.revision)throw Error('다른 화면에서 수정됐어요.');
   if(request.operation==='ignore'&&oldRecord.exists)throw Error('저장된 기록은 기록 목록에서 삭제해주세요.');
   const rows=[...current.data().rows];rows[index]={...before,input,issues:[],review:request.operation==='ignore'?'ignored':'confirmed',revision:before.revision+1};
   if(request.operation==='row'){
    const {date,...fields}=input;const values={...fields,performedAt:Timestamp.fromDate(new Date(date+'T12:00:00Z')),origin:oldRecord.data()?.origin||'ai-reviewed',status:'confirmed',revision:(oldRecord.data()?.revision||0)+1,updatedAt:stamp()};
    if(oldRecord.exists)tx.update(record,values);else{if((parent.data().recordCount||0)>=5000)throw Error('회원 기록 한도에 도달했어요.');tx.create(record,{...values,createdAt:stamp()});tx.update(member,{recordCount:(parent.data().recordCount||0)+1,lastRecordId:before.id,updatedAt:stamp()});}
   }
   tx.update(ref,{rows,revision:request.revision+1,updatedAt:stamp()});tx.create(member.collection('corrections').doc(),{fileId,rowId:before.id,before:before.input,after:request.operation==='ignore'?null:input,reason:typeof request.reason==='string'?request.reason.slice(0,500):'',createdAt:stamp()});
  });await scheduleReport(uid,mid);
 }
 async function knowledgeFor(member){
  const [generation,criteria,decisions,outcomes,corrections,plan]=await Promise.all([member.collection('analysis').doc('generation').get(),member.collection('judgmentSettings').doc('current').get(),member.collection('judgmentDecisions').orderBy('createdAt','desc').limit(20).get(),member.collection('judgmentOutcomes').orderBy('createdAt','desc').limit(40).get(),member.collection('corrections').orderBy('createdAt','desc').limit(5).get(),member.collection('plans').doc('current').get()]);
  return {generation:generation.data()?.value||null,criteria:criteria.data()??null,decisions:decisions.docs.map(d=>({id:d.id,...d.data()})),outcomes:outcomes.docs.map(d=>({id:d.id,...d.data()})),corrections:corrections.docs.map(d=>{const v=d.data();return {id:d.id,before:v.before??null,after:v.after??null,reason:v.reason??''};}),plan:plan.data()??null};
 }
 async function buildReport(uid,mid){
  const active=memberRef(uid,mid);if(!(await active.get()).exists)return;await active.collection('analysis').doc('current').set({status:'processing',startedAt:Timestamp.fromMillis(now()),updatedAt:stamp()},{merge:true});
  const member=memberRef(uid,mid),[m,records,importsSnap,knowledge]=await Promise.all([member.get(),recordsFor(member),member.collection('imports').get(),knowledgeFor(member)]);if(!m.exists)return;
  const imports=importsSnap.docs.map(d=>({id:d.id,...d.data()})),fingerprint=reportFingerprint(m.data(),records,imports,knowledge),cache=member.collection('reports').doc(fingerprint),current=member.collection('analysis').doc('current');
  const cached=await cache.get();if(cached.data()?.status==='ready'){await current.set({...cached.data(),updatedAt:stamp()});return {cached:true};}
  const judgmentContext=evaluateJudgment({records,goal:m.data().goal,criteria:knowledge.criteria,cases:selectCases(knowledge.decisions,knowledge.outcomes,records,now())});
  const summary=summarize(records),excludedCount=imports.reduce((n,i)=>n+(i.rows||[]).filter(r=>r.review==='needs-review').length+(i.unparsed||[]).length,0);
  if(!records.length){await current.set({status:'ready',fingerprint,judgmentContext,summary,excludedCount,scopeLimit:limits.maxRecords,report:{headline:'분석할 기록을 기다리고 있어요',overview:'확인이 필요한 날짜·중량을 수정하면 진행 분석과 수업 초안이 자동으로 준비돼요.',findings:[],limitations:['확인할 기록은 분석에 포함하지 않았어요.'],questions:[],program:[],quests:[]},updatedAt:stamp()});return {noCharge:true};}
  let claimed=false;const job=randomUUID();await db.runTransaction(async tx=>{claimed=false;const c=await tx.get(cache);if(c.data()?.status==='ready'||c.data()?.status==='processing')return;if(c.exists)return;tx.create(cache,{status:'processing',job,startedAt:Timestamp.fromMillis(now()),fingerprint});claimed=true;});if(!claimed){const state=(await cache.get()).data();if(state?.status==='error')await current.set({status:'error',error:state.error,updatedAt:stamp()},{merge:true});return {cached:true};}
  await current.set({status:'processing',fingerprint,summary,excludedCount,scopeLimit:limits.maxRecords,updatedAt:stamp()},{merge:true});
  try{
   const facts={goal:m.data().goal,notes:m.data().notes,summary:{...summary,exerciseTrends:undefined},excludedCount,records:records.map(({id,date,exerciseName,bodyPart,loadType,sets,status,origin,notes})=>({id,date,exerciseName,bodyPart,loadType,sets,status,origin,notes})),corrections:knowledge.corrections,confirmedPlan:knowledge.plan?{program:knowledge.plan.program,reason:knowledge.plan.reason}:null,judgmentContext:modelJudgmentContext(judgmentContext)};
   const result=await paid(uid,'analysis-and-plan',{system:REPORT_PROMPT,schema:{...REPORT_SCHEMA,properties:{...REPORT_SCHEMA.properties,judgments:judgmentResponseSchema(judgmentContext)}},parts:[{text:JSON.stringify(facts)}]},limits.reportOutputTokens);
   const report=validateReport(result.value,records,judgmentContext),value={status:'ready',fingerprint,model:MODEL,promptVersion:REPORT_VERSION,judgmentContext,evidenceRecords:facts.records,summary,excludedCount,scopeLimit:limits.maxRecords,report,usage:result.usage,updatedAt:stamp()};
   await cache.set(value);const latestRecords=await recordsFor(member),latestMember=await member.get(),latestImports=await member.collection('imports').get(),latestKnowledge=await knowledgeFor(member);
   if(!latestMember.exists)return;
   if(reportFingerprint(latestMember.data(),latestRecords,latestImports.docs.map(d=>({id:d.id,...d.data()})),latestKnowledge)!==fingerprint){await scheduleReport(uid,mid);return {stale:true};}
   await current.set(value);return {cached:false};
  }catch(e){await cache.set({status:'error',error:safeError(e),updatedAt:stamp()},{merge:true});await current.set({status:String(e.message).startsWith('AI_USAGE_LIMIT')?'limited':'error',error:safeError(e),updatedAt:stamp()},{merge:true});return {error:safeError(e)};}
 }
 async function retryReport(uid,mid,regenerate=false){const member=memberRef(uid,mid);if(regenerate){await member.collection('analysis').doc('generation').set({value:randomUUID()});await scheduleReport(uid,mid);return;}const current=await member.collection('analysis').doc('current').get();const value=current.data();if(value?.fingerprint){const cache=member.collection('reports').doc(value.fingerprint);await db.runTransaction(async tx=>{const c=await tx.get(cache);if(c.data()?.status==='error'||(c.data()?.status==='processing'&&c.data()?.startedAt?.toMillis()<now()-180000))tx.delete(cache);});}await scheduleReport(uid,mid);}
 async function savePlan(uid,mid,request){
  if(typeof request.reason!=='string'||request.reason.length>1000||!Array.isArray(request.program)||request.program.length>6)throw Error('수업 계획 입력을 확인해주세요.');
  const program=request.program.map(v=>{if(!v||typeof v.exerciseName!=='string'||!v.exerciseName.trim()||v.exerciseName.length>100||!Number.isInteger(v.sets)||v.sets<1||v.sets>8||typeof v.reps!=='string'||v.reps.length>100||typeof v.loadGuide!=='string'||v.loadGuide.length>500)throw Error('운동별 이름·세트·횟수·강도를 확인해주세요.');return {exerciseName:v.exerciseName.trim(),sets:v.sets,reps:v.reps,loadGuide:v.loadGuide,reason:typeof v.reason==='string'?v.reason.slice(0,700):'',recordId:typeof v.recordId==='string'?v.recordId:''};});
  const member=memberRef(uid,mid),ref=member.collection('plans').doc('current');await db.runTransaction(async tx=>{const [m,p]=await tx.getAll(member,ref);if(!m.exists||(p.data()?.revision||0)!==request.revision)throw Error('수업 계획이 변경됐어요. 최신 화면에서 다시 저장해주세요.');tx.set(ref,{program,reason:request.reason,basedOn:typeof request.basedOn==='string'?request.basedOn:'',revision:request.revision+1,updatedAt:stamp()});});
 }

 async function saveJudgmentCriteria(uid,mid,request){
  const member=memberRef(uid,mid),[m,records,plan]=await Promise.all([member.get(),recordsFor(member),member.collection('plans').doc('current').get()]);if(!m.exists)throw Error('회원이 없어요.');
  const input=validateCriteria(request.input,records,m.data().goal,plan.data());
  const ref=member.collection('judgmentSettings').doc('current');await db.runTransaction(async tx=>{const [current,parent,...latest]=await tx.getAll(ref,member,...records.filter(r=>input.confirmedRecordSignatures.some(v=>v.id===r.id)).map(r=>member.collection('records').doc(r.id)));if(!parent.exists||parent.data().goal!==m.data().goal||(current.data()?.revision??0)!==request.revision)throw Error('판단 기준이나 목표가 변경됐어요. 다시 확인해주세요.');for(const d of latest){const old=records.find(r=>r.id===d.id);if(!d.exists||d.data().revision!==old.revision)throw Error('비교할 기록이 변경됐어요. 다시 확인해주세요.');}tx.set(ref,{...input,revision:(current.data()?.revision??0)+1,updatedAt:stamp()});});await scheduleReport(uid,mid);
 }
 function short(value,max=500,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error('판단 내용과 이유를 확인해주세요.');return value.trim();}
 function requestId(value){if(typeof value!=='string'||!/^[-a-f0-9]{36}$/.test(value))throw Error('요청 식별자를 확인해주세요.');return value;}
 async function saveJudgmentDecision(uid,mid,request){
  const id=requestId(request.requestId),member=memberRef(uid,mid),ref=member.collection('judgmentDecisions').doc(id);
  if(!['maintain','adjust','check'].includes(request.choice))throw Error('유지·조정·추가 확인 중 선택해주세요.');
  const reason=short(request.reason),alternative=short(request.alternative,500,false),changeCondition=short(request.changeCondition,500,false),followUpMetric=short(request.followUpMetric,200),followUpDate=short(request.followUpDate,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(followUpDate)||!Number.isFinite(Date.parse(followUpDate))||new Date(followUpDate).toISOString().slice(0,10)!==followUpDate||followUpDate<judgmentDate(now()))throw Error('다음 확인 날짜를 지정해주세요.');
  await db.runTransaction(async tx=>{const [parent,analysis,existing]=await tx.getAll(member,member.collection('analysis').doc('current'),ref);if(!parent.exists)throw Error('회원이 없어요.');if(existing.exists)return;const v=analysis.data(),card=v?.judgmentContext?.cards.find(c=>c.id===request.cardId);if(v?.status!=='ready'||v.fingerprint!==request.fingerprint||!card)throw Error('최신 분석에서 판단을 남겨주세요.');const records=(v.evidenceRecords??[]).filter(r=>card.evidenceIds.includes(r.id)).slice(0,10);tx.create(ref,{cardId:card.id,cardVersion:card.version,action:request.choice,reason,alternative,changeCondition,followUpMetric,followUpDate,basedOn:v.fingerprint,snapshot:{goal:parent.data().goal,criteria:v.judgmentContext.criteria,card,records,analysis:v.report?.judgments?.find(j=>j.cardId===card.id)??null},createdAt:Timestamp.fromMillis(now())});});await scheduleReport(uid,mid);return {id};
 }
 async function saveJudgmentOutcome(uid,mid,request){
  const id=requestId(request.requestId),decisionId=requestId(request.decisionId),member=memberRef(uid,mid),ref=member.collection('judgmentOutcomes').doc(id);
  if(!['as_expected','different','unclear'].includes(request.result))throw Error('관찰 결과를 선택해주세요.');
  const note=short(request.note),observedDate=short(request.observedDate,10),records=await recordsFor(member);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(observedDate)||!Number.isFinite(Date.parse(observedDate))||new Date(observedDate).toISOString().slice(0,10)!==observedDate||observedDate>judgmentDate(now()))throw Error('실제로 관찰한 날짜를 입력해주세요.');
  await db.runTransaction(async tx=>{const [parent,decision,existing]=await tx.getAll(member,member.collection('judgmentDecisions').doc(decisionId),ref);if(!parent.exists||!decision.exists)throw Error('연결할 판단이 없어요.');if(existing.exists)return;if(observedDate<judgmentDate(decision.data().createdAt.toMillis()))throw Error('판단 이전 결과를 후속 결과로 기록할 수 없어요.');tx.create(ref,{decisionId,result:request.result,note,observedDate,records:records.filter(r=>r.date===observedDate).slice(0,10).map(r=>({id:r.id,date:r.date,exerciseName:r.exerciseName,sets:r.sets})),createdAt:Timestamp.fromMillis(now())});});await scheduleReport(uid,mid);return {id};
 }
 async function chat(uid,mid,request){
  const input=validateChatRequest(request),{image,...storedInput}=input,member=memberRef(uid,mid),ref=member.collection('chats').doc(input.requestId),payloadHash=hash({...storedInput,version:CHAT_VERSION});
  const [m,allRecords,a,p,source,importSnap]=await Promise.all([member.get(),recordsFor(member),member.collection('analysis').doc('current').get(),member.collection('plans').doc('current').get(),input.fileId?member.collection('files').doc(input.fileId).get():null,input.fileId?member.collection('imports').doc(input.fileId).get():null]);
  if(!m.exists)throw Error('회원이 없어요.');
  if(input.fileId&&(!source?.exists||source.data().status!=='ready'))throw Error('저장된 회원 원본을 선택해주세요.');
  if(input.selection&&source.data().contentType!=='application/pdf'&&input.selection.page!==1)throw Error('이미지 원본은 1쪽만 선택할 수 있어요.');
  const selectedRecords=allRecords.filter(r=>!input.fileId||r.sourceHash===input.fileId),byId=new Map(selectedRecords.map(r=>[r.id,r]));
  for(const row of importSnap?.data()?.rows??[])if(row.review!=='ignored'&&!byId.has(row.id))byId.set(row.id,{id:row.id,...row.input,status:row.review});
  const records=[...byId.values()].slice(0,120).map(({id,date,rawName,exerciseName,bodyPart,loadType,sets,notes,sourceHash,sourcePage,status})=>({id,date,rawName,exerciseName,bodyPart,loadType,sets,notes,sourceHash,sourcePage,status}));
  const history=[];let previous=input.previousId;
  for(let i=0;i<3&&previous;i++){const doc=await member.collection('chats').doc(previous).get(),v=doc.data();if(v?.status!=='ready')throw Error('이전 답변이 완료된 뒤 질문해주세요.');history.unshift({question:v.question,answer:v.answer});previous=v.previousId;}
  let claimed=false;const job=randomUUID();
  await db.runTransaction(async tx=>{claimed=false;const [parent,current]=await tx.getAll(member,ref);if(!parent.exists)throw Error('회원이 없어요.');const v=current.data();if(v){if(v.payloadHash!==payloadHash)throw Error('같은 질문 식별자로 다른 내용을 보낼 수 없어요.');if(v.status==='ready'||v.status==='error')return;if(v.startedAt?.toMillis()>now()-180000)throw Error('도우미가 답변 중이에요. 잠시 기다려주세요.');}
   tx.set(ref,{...storedInput,payloadHash,status:'processing',job,createdAt:v?.createdAt??Timestamp.fromMillis(now()),startedAt:Timestamp.fromMillis(now()),updatedAt:stamp(),version:CHAT_VERSION});claimed=true;});
  if(!claimed){const v=(await ref.get()).data();if(v.status==='error')throw Error(v.error);return {answer:v.answer,references:v.references,questions:v.questions,cached:true};}
  try{
   const analysis=a.data(),facts={question:input.question,history,scope:input.fileId?{fileId:input.fileId,name:source.data().name,selection:input.selection}: '최근 회원 기록 최대120개',goal:m.data().goal,notes:m.data().notes,records,summary:summarize(selectedRecords),analysis:analysis?.report??null,analysisStatus:analysis?.status??'missing',judgmentContext:analysis?.judgmentContext?modelJudgmentContext(analysis.judgmentContext):null,plan:p.data()?.program??[]};
   const result=await paid(uid,'assistant-chat',{system:CHAT_PROMPT,schema:chatSchema(records),parts:[{text:JSON.stringify(facts)},...(image?[image]:[])]},1800),answer=validateChatAnswer(result.value,records);
   await db.runTransaction(async tx=>{const [parent,current]=await tx.getAll(member,ref);if(!parent.exists||current.data()?.job!==job)throw Error('대화 상태가 변경됐어요.');tx.update(ref,{...answer,status:'ready',usage:result.usage,updatedAt:stamp()});});return {...answer,cached:false};
  }catch(e){await db.runTransaction(async tx=>{const [parent,current]=await tx.getAll(member,ref);if(parent.exists&&current.data()?.job===job)tx.update(ref,{status:'error',error:safeError(e),updatedAt:stamp()});});throw e;}
 }
 return {startImport,reviewImport,buildReport,scheduleReport,retryReport,savePlan,paid,saveJudgmentCriteria,saveJudgmentDecision,saveJudgmentOutcome,chat};
}
export function safeError(e){const s=String(e?.message||'');if(s.startsWith('AI_USAGE_LIMIT:'))return s.slice(15);if(/ACCESS_TOKEN_TYPE_UNSUPPORTED|invalid authentication credentials|API key not valid/i.test(s))return 'Gemini 인증 설정을 확인해주세요. 서비스 관리자에게 알려주세요.';if(/prepayment|credits.*depleted/i.test(s))return 'Gemini 크레딧이 부족해요. 서비스 관리자에게 알려주세요.';if(/429|quota/i.test(s))return 'AI 요청 한도에 도달했어요. 저장된 결과는 계속 볼 수 있어요.';if(/^[가-힣]/.test(s))return s.slice(0,500);return 'AI 작업을 완료하지 못했어요. 저장된 기록은 유지됩니다. 다시 시도할 수 있어요.';}
