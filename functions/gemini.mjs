import {MODEL} from './domain.mjs';
import {SEARCH_SAFETY,SEARCH_PROMPT,validatePublicQuery,groundedResult,searchQueryCount} from './web-search.mjs';
export function createGemini({apiKey,fetcher=fetch}){return async function gemini({system,schema,parts,maxOutputTokens,maxInputTokens,searchQuery,timeoutMs=120000}){
 const search=searchQuery!==undefined;
 // Rebuild search contents: private facts, history and images can never enter this call.
 if(search){searchQuery=validatePublicQuery(searchQuery);system=SEARCH_PROMPT;parts=[{text:searchQuery}];}
 const base=`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}`,headers={'Content-Type':'application/json','x-goog-api-key':apiKey()},signal=AbortSignal.timeout(timeoutMs);
 const generateContentRequest={model:`models/${MODEL}`,systemInstruction:{parts:[{text:system}]},contents:[{role:'user',parts}],generationConfig:{maxOutputTokens,...(!search?{responseMimeType:'application/json',responseSchema:schema}:{})},safetySettings:SEARCH_SAFETY,...(search?{tools:[{google_search:{}}]}:{})};
 const countResponse=await fetcher(base+':countTokens',{method:'POST',headers,body:JSON.stringify({generateContentRequest}),signal});
 const count=await countResponse.json();
 if(!countResponse.ok)throw Object.assign(Error('AI 서비스 요청을 처리하지 못했어요. 잠시 후 다시 시도해주세요.'),{notBillable:true,providerStatus:countResponse.status});
 if(!Number.isInteger(count.totalTokens))throw Object.assign(Error('AI 서비스 응답을 확인하지 못했어요. 다시 시도해주세요.'),{notBillable:true});
 if(count.totalTokens>maxInputTokens)throw Object.assign(Error('분석할 기록이 너무 많아요. 범위를 줄여주세요.'),{notBillable:true});
 const {model,...body}=generateContentRequest;
 const response=await fetcher(base+':generateContent',{method:'POST',headers,body:JSON.stringify(body),signal});
 const data=await response.json();if(!response.ok)throw Object.assign(Error(data.error?.message||`AI ${response.status}`),{notBillable:response.status>=400&&response.status<500});
 const m=data.usageMetadata||{},inputTokens=m.promptTokenCount,outputTokens=Number.isInteger(inputTokens)&&(Number.isInteger(m.totalTokenCount)||Number.isInteger(m.candidatesTokenCount))?Math.max(m.totalTokenCount-inputTokens||0,(m.candidatesTokenCount||0)+(m.thoughtsTokenCount||0)):undefined;
 const usage={inputTokens,outputTokens,...(search?{searchQueries:searchQueryCount(data)}:{})};
 if(data.promptFeedback?.blockReason||['SAFETY','PROHIBITED_CONTENT','BLOCKLIST'].includes(data.candidates?.[0]?.finishReason))throw Object.assign(Error('안전 기준에 따라 이 요청을 처리할 수 없어요. 예방이나 일반 교육 관점으로 질문해주세요.'),{usage});
 if(data.candidates?.[0]?.finishReason!=='STOP')throw Object.assign(Error('AI 응답이 끝까지 완료되지 않았어요. 다시 시도해주세요.'),{usage});
 let value;try{value=search?groundedResult(data):JSON.parse(data.candidates[0].content.parts.filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join(''));}catch(e){throw Object.assign(Error(search?e.message:'AI 응답 형식이 올바르지 않아요.'),{usage});}
 return {value,usage};
};}
