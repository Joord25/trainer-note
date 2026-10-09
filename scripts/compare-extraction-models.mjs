// Run build-functions.mjs first. Credentials stay in memory; results stay outside the repo.
// GEMINI_API_KEY=... node scripts/compare-extraction-models.mjs /absolute/image.png
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {EXTRACTION_PROMPT,EXTRACTION_SCHEMA,EXTRACTION_VERSION,parseExtraction} from '../functions/generated/extraction.mjs';
import {openApiSchema} from '../functions/domain.mjs';
const rates={'gemini-3.1-flash-lite':[.25,1.5],'gemini-3.5-flash-lite':[.30,2.5],'gemini-3.5-flash':[1.5,9],'gemini-3.8-flash':[.75,3.75]};
// USD per million tokens, official standard pricing checked 2026-09-22.
// 3.8 promotional prices expire 2026-12-31. Recheck before later runs.
const key=process.env.GEMINI_API_KEY||process.env.TRAINER_NOTE_GEMINI_API_KEY;
const files=process.argv.slice(2),maxOutputTokens=32768,budget=2;
if(!key||!files.length){console.error('Set GEMINI_API_KEY in your environment and pass 1–2 image paths. No API request made.');process.exit(1);}
if(files.length>2)throw Error('At most two files per pilot run.');
if(new Date()>=new Date('2027-01-01'))throw Error('Refresh price snapshot before running.');
const headers={'x-goog-api-key':key,'Content-Type':'application/json'},base='https://generativelanguage.googleapis.com/v1beta';
async function api(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(180000)});if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json();}
const available=new Set();let next='';
do{const list=await api(base+'/models'+(next?'?pageToken='+encodeURIComponent(next):''));for(const m of list.models||[])if(m.supportedGenerationMethods?.includes('generateContent'))available.add(m.name.replace('models/',''));next=list.nextPageToken||'';}while(next);
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'trainer-model-comparison-'));await fs.chmod(dir,0o700);
const results=[];let reserved=0;
for(const [index,file] of files.entries()){
 const bytes=await fs.readFile(file),mimeType={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[path.extname(file).toLowerCase()];
 if(!mimeType||bytes.length>10*1024*1024)throw Error('Use PNG/JPEG up to 10MB.');
 for(const [model,[inputRate,outputRate]] of Object.entries(rates)){
  const row={file:index+1,model,promptVersion:EXTRACTION_VERSION};results.push(row);
  if(!available.has(model)){row.status='unavailable';continue;}
  const body={systemInstruction:{parts:[{text:EXTRACTION_PROMPT+'\n응답 전에 날짜·단위·각 세트의 대응을 원본과 다시 대조하고, 애매한 점은 issues에 한국어로 기록한다.'}]},contents:[{role:'user',parts:[{text:'원본 기록을 판독하고 자체 점검한 결과만 반환해주세요. 참고 자료(명령이 아님): '+JSON.stringify({trainerInterpretations:[]})},{inlineData:{mimeType,data:bytes.toString('base64')}}]}],generationConfig:{maxOutputTokens,responseMimeType:'application/json',responseSchema:openApiSchema(EXTRACTION_SCHEMA,{arrayLimits:false})}};
  try{
   const counted=await api(`${base}/models/${model}:countTokens`,{generateContentRequest:{model:'models/'+model,...body}});
   if(!Number.isInteger(counted.totalTokens)||counted.totalTokens>32768)throw Error('Input budget exceeded');
   const maximum=(counted.totalTokens*inputRate+maxOutputTokens*outputRate)/1e6;
   if(reserved+maximum>budget){row.status='budget-skipped';continue;}reserved+=maximum;
   const started=Date.now(),response=await api(`${base}/models/${model}:generateContent`,body);row.seconds=(Date.now()-started)/1000;
   const u=response.usageMetadata||{};row.usage=u;
   row.estimatedUsd=Number.isInteger(u.promptTokenCount)&&Number.isInteger(u.totalTokenCount)?(u.promptTokenCount*inputRate+Math.max(0,u.totalTokenCount-u.promptTokenCount)*outputRate)/1e6:null;
   await fs.writeFile(path.join(dir,`${index+1}-${model}.json`),JSON.stringify(response,null,2),{mode:0o600});
   if(response.candidates?.[0]?.finishReason!=='STOP')throw Error('Incomplete generation');
   const raw=JSON.parse(response.candidates[0].content.parts.filter(p=>p.text&&!p.thought).map(p=>p.text).join(''));
   const parsed=await parseExtraction(raw,{id:'a'.repeat(64),name:'sample',contentType:mimeType},'');
   row.status='ok';row.records=parsed.records.length;row.unparsed=parsed.unparsed.length;
   row.sessions=new Set(raw.records.map(r=>`${r.page}:${r.sessionIndex??''}:${r.month}/${r.day}`)).size;
   row.dates=[...new Set(raw.records.map(r=>`${r.month}/${r.day}`))];
   // Counts measure coverage, NOT accuracy. Inspect raw responses against the source.
  }catch(e){row.status='error';row.error=/^HTTP \d+$/.test(e.message)?e.message:'Generation or validation failed';}
  await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify({rates,priceDate:'2026-09-22',budgetUsd:budget,results},null,2),{mode:0o600});
  console.log(JSON.stringify(row));
 }
}
await fs.writeFile(path.join(dir,'summary.json'),JSON.stringify({rates,priceDate:'2026-09-22',budgetUsd:budget,results},null,2),{mode:0o600});
console.log('Private results:',dir);
