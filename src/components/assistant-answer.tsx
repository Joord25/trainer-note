"use client";
import {useState,type ReactNode} from 'react';
import type {ChatMessage} from '../lib/server-ai';
import {Icon} from './icons';
type WebSource={url:string;title:string};
function safeSource(source:WebSource){try{const url=new URL(source.url);return url.protocol==='https:'&&!url.username&&!url.password;}catch{return false;}}
// Render a small, text-only Markdown subset; model HTML and arbitrary links stay inert.
export function AnswerText({text,sources=[]}:{text:string;sources?:WebSource[]}){
 function inline(value:string):ReactNode[]{return value.split(/(\*\*[^*\n]+\*\*|\[웹\d+\])/g).map((part,i)=>{
  if(part.startsWith('**')&&part.endsWith('**'))return <strong key={i}>{part.slice(2,-2)}</strong>;
  const match=/^\[웹(\d+)\]$/.exec(part),source=match?sources[Number(match[1])-1]:null;
  return source&&safeSource(source)?<a className="assistant-inline-source" key={i} href={source.url} title={source.title} target="_blank" rel="noopener noreferrer">{part}</a>:part;
 });}
 // Older answers sometimes flattened numbered sections. Only split sentence boundaries,
 // never decimal loads, dates, or a number inside a sentence.
 const lines=text.replace(/([.!?。]) +(?=\d{1,2}\. [^\d\s])/g,'$1\n\n').split(/\r?\n/),blocks:ReactNode[]=[];
 let paragraph:string[]=[],items:{number?:number;text:string}[]=[];
 function flushParagraph(){if(paragraph.length){blocks.push(<p key={blocks.length}>{inline(paragraph.join('\n'))}</p>);paragraph=[];}}
 function flushList(){if(items.length){const ordered=items[0].number!==undefined,children=items.map((item,i)=><li key={i} value={item.number}>{inline(item.text)}</li>);blocks.push(ordered?<ol key={blocks.length} start={items[0].number}>{children}</ol>:<ul key={blocks.length}>{children}</ul>);items=[];}}
 for(const raw of lines){const line=raw.trim(),heading=/^#{1,4}\s+(.+)$/.exec(line),item=/^(?:(\d{1,2})[.)]|[-*•])\s+(.+)$/.exec(line);
  if(!line){flushParagraph();flushList();}
  else if(heading){flushParagraph();flushList();blocks.push(<h4 key={blocks.length}>{inline(heading[1])}</h4>);}
  else if(item){flushParagraph();const number=item[1]?Number(item[1]):undefined;if(items.length&&(items[0].number===undefined)!==(number===undefined))flushList();items.push({number,text:item[2]});}
  else{flushList();paragraph.push(line);}
 }
 flushParagraph();flushList();return <div className="assistant-answer-body">{blocks}</div>;
}
export type RecordReference={id:string;date:string;exerciseName:string;sourcePage?:number};
export function AnswerRecords({scope,ids=[],records=[],saved=[],onOpen}:{scope?:ChatMessage['contextScope'];ids?:string[];records?:RecordReference[];saved?:RecordReference[];onOpen:(id:string)=>void}){
 if(!ids.length)return null;
 return <details className="assistant-record-sources"><summary><Icon name="file" size={14}/>참고한 운동 기록 <span>{ids.length}</span></summary><p>답변에 참고한 회원 기록이에요. 누르면 기록 수정에서 확인할 수 있어요. 웹 자료나 기관 지침의 출처는 아니에요.</p>{scope&&<p className="assistant-context-scope">분석 범위 {scope.from}–{scope.to} · {scope.sessionCount}일 / {scope.recordCount}개 기록{scope.capture?' · 캡처 포함':''}</p>}<div>{ids.map(id=>{const current=records.find(r=>r.id===id),record=saved.find(r=>r.id===id)??current,label=record?`${record.date||'날짜 미확인'} · ${record.exerciseName||'운동명 미확인'}`:'현재 확인할 수 없는 기록';return <button type="button" key={id} disabled={!current} title={current?'기록 수정에서 확인':`${label} · 현재 기록이 없어요`} onClick={()=>onOpen(id)}><span>{label}</span>{!!record?.sourcePage&&<small>{record.sourcePage}쪽</small>}<Icon name="arrow" size={13}/></button>;})}</div></details>;
}
export function AnswerSources({sources=[],suggestions}:{sources?:WebSource[];suggestions?:string}){
 if(!sources.some(safeSource))return null;
 return <div className="assistant-web-sources"><span><Icon name="globe" size={14}/> 웹 출처</span><div>{sources.map((source,i)=>safeSource(source)?<a key={i} href={source.url} title={source.title} target="_blank" rel="noopener noreferrer">{i+1}. {source.title}</a>:null)}</div>{suggestions&&<iframe className="assistant-search-suggestions" title="Google 검색 추천" sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={'<meta http-equiv="Content-Security-Policy" content="default-src &#39;none&#39;; style-src &#39;unsafe-inline&#39;; img-src data: https://www.gstatic.com; base-uri &#39;none&#39;; form-action &#39;none&#39;">'+suggestions}/>}</div>;
}
export function AnswerActions({message,disabled,canRegenerate,onRegenerate}:{message:ChatMessage;disabled:boolean;canRegenerate:boolean;onRegenerate:()=>void}){
 const [copied,setCopied]=useState(false),[error,setError]=useState('');
 async function copy(){try{const sources=(message.webSources??[]).filter(safeSource),text=(message.answer??'')+(sources.length?'\n\n출처\n'+sources.map((s,i)=>`${i+1}. ${s.title}: ${s.url}`).join('\n'):'');await navigator.clipboard.writeText(text);setCopied(true);setError('');}catch{setCopied(false);setError('복사하지 못했어요. 브라우저의 클립보드 권한을 확인해주세요.');}}
 return <><div className="assistant-answer-actions"><button type="button" onClick={()=>void copy()}><Icon name={copied?'check':'copy'} size={15}/>{copied?'복사됨':'복사'}</button>{canRegenerate&&<button type="button" disabled={disabled} onClick={()=>{setCopied(false);onRegenerate();}}><Icon name="refresh" size={15}/>다시 생성</button>}</div><span className="assistant-copy-status" role="status">{copied?'답변을 복사했어요.':''}</span>{error&&<p className="file-error" role="alert">{error}</p>}</>;
}
