"use client";
import {toFriendlyExplanation} from '../lib/explanation-tone';
export type CoachingResearch={status:'verified'|'unverified'|'unavailable'|'restricted';notice:string;checkedAt:string;query:string;searchSuggestions?:string;sources:{id:string;title:string;url:string;type:string;documentKind:string;excerpt:string;claim:string;scope:string}[]};
export function ResearchText({text,research}:{text:string;research?:CoachingResearch}){
 return <>{toFriendlyExplanation(text).replace(/\bWEB(\d+)\b/g,'[웹$1]').replace(/\[웹\s+(\d+)\]/g,'[웹$1]').split(/(\[웹\d+\])/g).map((part,index)=>{const n=/^\[웹(\d+)\]$/.exec(part),source=n?research?.sources.find(s=>s.id==='WEB'+n[1]):null;return source?<a className="assistant-inline-source" key={index} href={source.url} target="_blank" rel="noopener noreferrer" aria-label={`출처 ${n![1]}: ${source.title}`}>{n![1]}</a>:part;})}</>;
}
export function CoachingResearchNote({research}:{research?:CoachingResearch}){
 if(!research)return null;
 return <details className="coaching-research-note"><summary>{research.status==='verified'?`학술·기관 자료 확인 · ${research.sources.length}개`:'외부 근거 확인 미완료'}</summary><p>{research.notice}</p><small>논문·학술 자료와 허용 기관의 공식 가이드만 사용해요. {new Date(research.checkedAt).toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})} 확인</small>{research.query&&<p className="research-query">검색어: {research.query}</p>}{research.sources.map((source,i)=><section key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{i+1}. {source.title} ↗</a><small>{source.type}</small><blockquote>{source.excerpt}</blockquote><p>{toFriendlyExplanation(source.claim)}</p><p><strong>적용 조건</strong> {toFriendlyExplanation(source.scope)}</p></section>)}</details>;
}
