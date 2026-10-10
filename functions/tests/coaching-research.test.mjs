import {test} from 'node:test';
import assert from 'node:assert/strict';
import {primaryUrl,readPrimarySource,validateResearchExtract,researchCoaching} from '../coaching-research.mjs';
import {prepareChangeRequest} from '../coaching-workflow.mjs';
import {requireNarrativeSources} from '../goal-decision.mjs';
const url='https://www.who.int/publications/guideline';
const excerpt='Adults should do regular physical activity throughout the week.';
const body=(excerpt+' ').repeat(30);
const doc={url,title:'Official guideline',body,coverage:'공개 본문 확인'};
const item={index:0,documentKind:'guideline',excerpt,claim:'주간 신체 활동을 권장해요.',scope:'성인 대상 일반 지침이에요.'};
const html=()=>new Response('<title>Official guideline</title><main>'+body+'</main>',{headers:{'content-type':'text/html'}});
test('allowlist rejects lookalikes, protocols, private destinations and credentials',()=>{
 for(const u of ['https://who.int.evil.com/','http://who.int/','https://127.0.0.1/','https://user@who.int/','https://who.int:444/','https://researchgate.net/paper'])assert.equal(primaryUrl(u),null);
 assert.equal(primaryUrl(url),url);
});
test('redirect cannot escape approved originals, including Google citation redirects',async()=>{
 const calls=[];await assert.rejects(readPrimarySource({url:'https://vertexaisearch.cloud.google.com/grounding-api-redirect/abc'},{fetcher:async u=>{calls.push(u);return new Response(null,{status:302,headers:{location:'http://169.254.169.254/latest'}});}}),/unsupported/);assert.equal(calls.length,1);
 const result=await readPrimarySource({url},{fetcher:async()=>html()});assert.equal(result.url,url);assert.ok(result.body.includes(excerpt));
 await assert.rejects(readPrimarySource({url},{fetcher:async()=>new Response('PDF',{headers:{'content-type':'application/pdf'}})}),/unavailable/);
});
test('extraction requires a supported document kind and exact bounded quote, never invented sources',()=>{
 const sources=validateResearchExtract({items:[item]},[doc],'2026-10-11');assert.equal(sources[0].id,'WEB1');assert.equal(sources[0].url,url);
 for(const patch of [{documentKind:'unsupported'},{excerpt:'An invented recommendation that the page never made.'},{index:3},{excerpt:body},{claim:''}])assert.deepEqual(validateResearchExtract({items:[{...item,...patch}]},[doc],''),[]);
 assert.deepEqual(validateResearchExtract({items:[item]},[{...doc,url:'https://evil.com'}],''),[]);
});
test('analysis research sends only the gated public query to search; private facts stay in planning',async()=>{
 const calls=[];
 const result=await researchCoaching({uid:'u',privateTerms:['회원홍길동'],facts:{goal:{primary:'체력'},memberNotes:'회원홍길동 private note'},fetcher:async()=>html(),paid:async(uid,kind,request)=>{
 calls.push({kind,request});return {value:kind==='coaching-search-plan'?{query:'WHO physical activity adults'}:kind==='search-safety'?{allowed:true,reason:'safe'}:kind==='coaching-web-search'?{sources:[{url,title:'WHO'}],searchSuggestions:'<div>Search</div>'}:{items:[item]}};
 }});
 assert.equal(result.status,'verified');assert.equal(result.sources[0].url,url);
 const search=calls.find(c=>c.kind==='coaching-web-search').request;assert.equal(search.searchPolicy,'coaching-evidence');assert.equal(search.searchQuery,'WHO physical activity adults');assert.equal(search.parts,undefined);assert.ok(!JSON.stringify(search).includes('회원홍길동'));
});
test('private query, unavailable research and non-scholarly sources never become verified',async()=>{
 let searches=0;
 const paid=async(uid,kind)=>{if(kind==='coaching-search-plan')return {value:{query:'홍길동 physical activity'}};searches++;throw Error('unexpected');};
 const privateResult=await researchCoaching({paid,uid:'u',facts:{},privateTerms:['홍길동']});assert.notEqual(privateResult.status,'verified');assert.equal(searches,0);
 const failed=await researchCoaching({paid:async()=>{throw Error('timeout');},uid:'u',facts:{}});assert.equal(failed.status,'unavailable');assert.deepEqual(failed.sources,[]);
});
test('request-local source schema never leaks between members; unknown citations fail',()=>{
 const facts={evidence:[],publicResearch:{status:'verified',sources:[{id:'WEB1',url}]}};
 const a=prepareChangeRequest(facts),b=prepareChangeRequest({evidence:[]});
 assert.ok(a.schema.properties.goalReview.properties.sourceIds.items.enum.includes('WEB1'));
 assert.ok(!b.schema.properties.goalReview.properties.sourceIds.items.enum.includes('WEB1'));
 assert.ok(!b.schema.properties.goalReview.properties.lenses.items.properties.sourceIds.items.enum.includes('WEB1'));
 assert.deepEqual(requireNarrativeSources('WHO 기준 [웹1]',['WEB1'],'test',facts.publicResearch.sources),['WEB1']);
 assert.throws(()=>requireNarrativeSources('WHO 기준 [웹2]',['WHO2020'],'test',facts.publicResearch.sources),/확인되지/);
});

test('PubMed uses only the official numeric-ID API and labels abstracts; retractions fail closed',async()=>{
 const calls=[];const xml='<PubmedArticle><PMID>123456</PMID><ArticleTitle>Training study</ArticleTitle><Abstract><AbstractText>'+body+'</AbstractText></Abstract><PublicationTypeList>Meta-Analysis</PublicationTypeList></PubmedArticle>';
 const d=await readPrimarySource({url:'https://pubmed.ncbi.nlm.nih.gov/123456/'},{fetcher:async(u,o)=>{calls.push([u,o.redirect]);return new Response(xml,{headers:{'content-type':'text/xml'}});}});
 assert.equal(calls[0][0],'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=123456&retmode=xml');assert.equal(calls[0][1],'error');assert.match(d.coverage,/초록/);assert.equal(d.url,'https://pubmed.ncbi.nlm.nih.gov/123456/');
 for(const invalid of [xml.replace('123456','999999'),xml.replace('Meta-Analysis','Retracted Publication')])await assert.rejects(readPrimarySource({url:d.url},{fetcher:async()=>new Response(invalid,{headers:{'content-type':'text/xml'}})}));
});

test('verified raw source IDs become linked references; invented raw IDs still fail',()=>{
 const sources=[{id:'WEB1',url}];
 assert.deepEqual(requireNarrativeSources('WHO 기준과 공개 연구(WEB1)를 비교해요.',['WHO2020'],'test',sources),['WHO2020','WEB1']);
 assert.throws(()=>requireNarrativeSources('공개 연구(WEB99)',['WHO2020'],'test',sources),/확인되지/);
});
