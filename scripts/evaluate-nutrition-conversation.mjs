// Synthetic-only multi-turn regression. No Firestore reads or member data.
// node scripts/evaluate-nutrition-conversation.mjs --live --firebase-key
// Default validates context locally. --live makes 8 billed generations.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createGemini} from '../functions/gemini.mjs';
import {CHAT_VERSION,chatEvidencePrompt,CHAT_MAX_INPUT_TOKENS,chatMode,chatSchema,prepareChatFacts,validateChatAnswer} from '../functions/chat.mjs';
const questions=[
 '회원의 등록 목표는 "다이어트(체지방 감소)"입니다. 이 목표에 맞는 식단·영양 상담을 이어가고 싶어요. 없는 정보를 추정하지 말고 식사 패턴·선호·알레르기부터 확인해주세요.',
 '하루 2회 집에서, 없음, 불규칙이지만 규칙적으로 먹으려 노력중',
 '혹시 표로 만들어줄수있어? 정리해서 보기 쉽게',
 '아니 식단....'
];
const live=process.argv.includes('--live');let key=process.env.TRAINER_NOTE_GEMINI_API_KEY||process.env.GEMINI_API_KEY;
if(live&&!key&&process.argv.includes('--firebase-key')){
 const secret=spawnSync('firebase',['functions:secrets:access','TRAINER_NOTE_GEMINI_API_KEY','--project','trainer-note-a9dd7'],{encoding:'utf8',maxBuffer:1024*1024});
 if(secret.status!==0)throw Error('Configured credential unavailable. No model called.');key=secret.stdout.trim();
}
if(live&&!key)throw Error('Configure a server credential. No model called.');
const model=live?createGemini({apiKey:()=>key}):null,results=[],output=live?await mkdtemp(join(tmpdir(),'trainer-nutrition-conversation-')):null;
if(output)console.log('Output:',output);
for(const answerMode of ['quick','deep']){
 let history=[];
 for(const [index,question] of questions.entries()){
  const facts=prepareChatFacts({question,asOf:'2026-10-10',history,goal:'다이어트(체지방 감소)',training:{currentGoal:'근비대'},analysis:{goal:'근비대'},records:[{id:'PRIVATE_SENTINEL',exerciseName:'핵 스쿼트',sets:[{kg:40,reps:34}]}],notes:'PRIVATE_SENTINEL'});
  assert.deepEqual(facts.records,[]);assert.ok(!JSON.stringify(facts).includes('PRIVATE_SENTINEL'));
  assert.equal(facts.scope,'nutrition');assert.equal(facts.nutrition.conditions.goal,'다이어트(체지방 감소)');
  if(index>0)assert.equal(facts.nutrition.conditions.mealsPerDay,2);
  if(index>=2)assert.equal(facts.nutrition.requestedFormat,'table');
  let answer='알려주신 식단 조건에 근거한 설명';
  if(live){
   const mode=chatMode(answerMode,question,facts.chatContext),started=Date.now();
   const result=await model({model:mode.model,thinkingLevel:mode.thinkingLevel,system:mode.systemPrompt+'\n'+mode.prompt+chatEvidencePrompt(facts),schema:chatSchema([],question,false,facts.chatContext),parts:[{text:JSON.stringify(facts)}],maxInputTokens:CHAT_MAX_INPUT_TOKENS,maxOutputTokens:mode.maxOutputTokens,timeoutMs:60000});
   const validated=validateChatAnswer(result.value,[],answerMode);answer=validated.answer;
   assert.deepEqual(validated.references,[]);assert.ok(!/근비대|스쿼트|렛 풀|시티드 로우/.test(answer));
   if(index===0)assert.equal(validated.questions.length,1);
   if(index>0)assert.deepEqual(validated.questions,[]);
   if(index>=2){assert.ok(result.value.nutritionTable?.length>=2);assert.match(answer,/\| 끼니 \| 메뉴와 예시 분량 \|/);}
   results.push({answerMode,index,question,answer,questions:validated.questions,raw:result.value,seconds:(Date.now()-started)/1000,usage:result.usage});
   await writeFile(join(output,'results.json'),JSON.stringify({version:CHAT_VERSION,results},null,2),{mode:0o600});
   await writeFile(join(output,'review.md'),results.map(r=>`## ${r.answerMode} / ${r.index+1}\n\n${r.question}\n\n${r.answer}\n${(r.questions??[]).map(q=>'질문: '+q).join('\n')}\n`).join('\n'),{mode:0o600});
   console.log(answerMode,index+1,'received',answer.length,'characters');
  }
  history=[...history,{question,answer,chatContext:facts.chatContext}].slice(-3);
 }
}
console.log(live?'Finished. Review goal, two home meals, no repeated intake, and nutrition tables manually.':'8 context checks passed. No model called.');
