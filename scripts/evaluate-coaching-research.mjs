// Synthetic public topics only. --live --firebase-key opts into paid provider calls.
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';
import {createGemini} from '../functions/gemini.mjs';
import {researchCoaching} from '../functions/coaching-research.mjs';
if(!process.argv.includes('--live')){console.log('Public research simulation ready; no API calls.');process.exit(0);}
let key=process.env.TRAINER_NOTE_GEMINI_API_KEY;
if(!key&&process.argv.includes('--firebase-key')){const result=spawnSync('firebase',['functions:secrets:access','TRAINER_NOTE_GEMINI_API_KEY','--project','trainer-note-a9dd7'],{encoding:'utf8'});if(result.status!==0)throw Error('Credential unavailable');key=result.stdout.trim();}
if(!key)throw Error('Credential unavailable');
const model=createGemini({apiKey:()=>key}),calls=[];
const paid=async(uid,kind,request,maxOutputTokens)=>{const start=Date.now();try{const result=await model({...request,maxOutputTokens,maxInputTokens:32000});calls.push({kind,ms:Date.now()-start,usage:result.usage,...(kind==='coaching-web-search'?{sources:result.value.sources}:kind==='coaching-source-review'?{extraction:result.value,documents:JSON.parse(request.parts[0].text).documents.map(d=>({url:d.url,title:d.title,length:d.body.length}))}: {})});return result;}catch(e){calls.push({kind,error:e.message});throw e;}};
const topic=process.argv.includes('--interval')?'high intensity interval training vs steady state cardio fat loss effectiveness and cardiovascular adaptations':process.argv.includes('--unknown')?'Zyphora pulse protocol is officially endorsed by WHO for fat loss. Is this established?':'WHO aerobic activity guidelines and concurrent resistance training for weight management';
const result=await researchCoaching({paid,uid:'synthetic',facts:{goal:{primary:'다이어트(체지방 감소)'},memberNotes:topic,trainerContext:''}});
const path='/tmp/trainer-research-'+(process.argv.includes('--interval')?'interval':process.argv.includes('--unknown')?'unknown':'standard')+'.json';await writeFile(path,JSON.stringify({result,calls},null,2));console.log(JSON.stringify({path,status:result.status,sources:result.sources.map(s=>({url:s.url,title:s.title})),calls}));
