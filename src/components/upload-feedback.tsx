"use client";
import {useEffect,useRef} from 'react';
import {Icon} from './icons';
import {uploadSummaryText,type UploadResult} from '../lib/upload-result';
import type {ExistingSource} from '../lib/source-file';

// Stays inside the upload dialog: no second modal or hidden message after a long list.
export function UploadFeedback({result,error,notice,busy,onDismiss,onRetry,onExisting,onContinue,onRefresh}:{result:UploadResult|null;error:string;notice:string;busy:boolean;onDismiss:()=>void;onRetry?:()=>void;onExisting:(source:ExistingSource)=>void;onContinue?:()=>void;onRefresh:()=>void}) {
  const panel=useRef<HTMLDivElement>(null);
  useEffect(()=>{if(result||error||notice){panel.current?.scrollIntoView({block:'nearest'});panel.current?.focus({preventScroll:true});}},[result,error,notice]);
  if(!result&&!error&&!notice)return null;
  const warning=!!error||!!result?.failed;
  return <div ref={panel} tabIndex={-1} className="upload-feedback" data-tone={warning?'error':result?.duplicates?'info':'success'} aria-label="파일 처리 결과">
    <div className="upload-feedback-heading"><Icon name={warning?'file':result?.duplicates?'copy':'check'} size={21}/><strong role={warning?'alert':'status'}>{error?'파일 처리 중 확인이 필요해요':result?uploadSummaryText(result):notice}</strong><button type="button" className="icon-button" disabled={busy} aria-label="파일 처리 알림 닫기" onClick={onDismiss}><Icon name="close" size={18}/></button></div>
    {error&&<p className="upload-feedback-error">{error}</p>}
    {!!result?.issues.length&&<ul className="upload-feedback-details">{result.issues.map((issue,i)=><li key={i}><div><span className="upload-issue-kind">{issue.existing?'중복':'실패'}</span><strong>{issue.name}</strong><p>{issue.message}</p></div>{issue.existing&&!issue.existing.originalRemoved&&issue.existing.status==='ready'&&<button type="button" disabled={busy} onClick={()=>onExisting(issue.existing!)}>기존 파일 열기</button>}{issue.existing&&!issue.existing.originalRemoved&&issue.existing.status!=='ready'&&<button type="button" disabled={busy} onClick={()=>onExisting(issue.existing!)}>목록에서 확인</button>}</li>)}</ul>}
    <div className="upload-feedback-actions">{result?.failed&&onRetry?<button type="button" disabled={busy} onClick={onRetry}>실패한 {result.failed}개만 다시 시도</button>:null}{error&&<button type="button" disabled={busy} onClick={onRefresh}>목록 새로고침</button>}{onContinue&&result&&result.uploaded>0&&<button type="button" className="primary" disabled={busy} onClick={onContinue}>업로드한 {result.uploaded}개 기록 보기</button>}</div>
  </div>;
}
