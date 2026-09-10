"use client";
import {useEffect,useRef,useState} from 'react';
import {Icon} from './icons';
import {RecordEditor} from './member-records';
import {readMemberFile,type MemberFile} from '../lib/member-files';
import {findSourceRecords} from '../lib/workout-records';
import {aiError,extractWorkout} from '../lib/workout-ai';
import {EXTRACTION_MODEL,MAX_AI_BYTES,type Extraction,type ExtractedWorkout} from '../lib/workout-extraction';

export function AiRecordImport({file,memberId,memberName,online,onClose}:{file:MemberFile;memberId:string;memberName:string;online:boolean;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),alive=useRef(true),controller=useRef<AbortController|null>(null),working=useRef(false);
 const [phase,setPhase]=useState<'start'|'reading'|'review'>('start'),[year,setYear]=useState(''),[memberConfirmed,setMemberConfirmed]=useState(false),[error,setError]=useState(''),[result,setResult]=useState<Extraction|null>(null),[blob,setBlob]=useState<Blob|null>(null),[editor,setEditor]=useState<ExtractedWorkout|null>(null),[saved,setSaved]=useState<Set<string>>(new Set()),[previousCount,setPreviousCount]=useState(0),[discard,setDiscard]=useState(false);
 const remaining=result?.records.filter(r=>!saved.has(r.id)).length??0;
 useEffect(()=>{alive.current=true;const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{alive.current=false;controller.current?.abort();previous?.focus();};},[]);
 useEffect(()=>{if(phase!=='reading'&&!remaining)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[phase,remaining]);
 function close(){if(phase==='reading')controller.current?.abort();if(remaining){setDiscard(true);return;}onClose();}
 async function read(){
  if(working.current||!online||!memberConfirmed)return;
  if(year&&(!/^\d{4}$/.test(year)||Number(year)<1900||Number(year)>2100)){setError('기록 연도는 1900~2100년으로 입력해주세요.');return;}
  if(file.size>MAX_AI_BYTES){setError('AI 판독은 파일당 10MB까지 가능해요. PDF를 나누거나 이미지 용량을 줄여주세요.');return;}
  working.current=true;setError('');setPhase('reading');const abort=new AbortController();controller.current=abort;
  try{
   const previous=await findSourceRecords(memberId,file.id);abort.signal.throwIfAborted();
   const source=await readMemberFile(memberId,file.id,file.contentType);abort.signal.throwIfAborted();
   const extraction=await extractWorkout(source,file,memberName,year?Number(year):undefined,abort.signal);
   if(!alive.current)return;
   setBlob(source);setResult(extraction);setSaved(new Set(previous.map(r=>r.id)));setPreviousCount(previous.length);setPhase('review');
  }catch(e){if(alive.current){setError(aiError(e));setPhase('start');}}
  finally{working.current=false;controller.current=null;}
 }
 return <><dialog ref={dialog} className="ai-import-dialog" onCancel={e=>{e.preventDefault();close();}}><div className="record-editor-heading"><div><small>{memberName} · 원본에서 기록으로</small><h2>{phase==='review'?'읽은 기록 확인':'AI로 운동일지 읽기'}</h2></div><button className="icon-button" aria-label="판독 화면 닫기" onClick={close}><Icon name="close"/></button></div><div className="ai-import-body">
  <div className="ai-source-card"><Icon name="file" size={24}/><div><strong>{file.name}</strong><small>{EXTRACTION_MODEL} · {Math.round(file.size/1024)} KB</small></div></div>
  {phase==='start'&&<><p className="ai-intro">날짜, 운동명, 세트 기록을 읽어 초안으로 정리해요. 원본과 비교한 뒤 확정하면 회원의 실제 기록에 반영됩니다.</p><label className="field-label">기록 연도 <span>원본에 연도가 없을 때만 적용 · 선택</span><input type="number" min="1900" max="2100" step="1" placeholder="예: 2026" value={year} onChange={e=>setYear(e.target.value)}/></label><label className="record-confirm"><input type="checkbox" checked={memberConfirmed} onChange={e=>setMemberConfirmed(e.target.checked)}/>이 파일이 {memberName} 회원의 운동일지임을 확인했어요.</label><p className="record-help">‘판독 시작’을 누르면 이 파일을 Google Gemini에 보내 읽어요. 파일당 최대 10MB이며, 읽은 초안은 확인 전까지 운동 통계에 포함되지 않습니다.</p><div className="dialog-footer"><button onClick={close}>취소</button><button className="primary" disabled={!online||!memberConfirmed||file.size>MAX_AI_BYTES} onClick={()=>void read()}>판독 시작</button></div>{file.size>MAX_AI_BYTES&&<p className="file-error">원본 저장은 50MB까지, AI 판독은 10MB까지 지원해요. 파일을 나눠주세요.</p>}</>}
  {phase==='reading'&&<div className="ai-reading" role="status"><span className="ai-reading-dot"/><h3>원본에서 운동 기록을 읽고 있어요</h3><p>페이지 수와 손글씨에 따라 잠시 걸릴 수 있어요.</p><button onClick={()=>controller.current?.abort()}>판독 중단</button></div>}
  {phase==='review'&&result&&<><div className="ai-result-heading"><div><strong>{result.records.length}개 운동을 읽었어요</strong><p>아직 확인하지 않은 기록 {remaining}개 · 필요한 항목을 열어 수정하세요.</p></div></div>{previousCount>0&&<p className="ai-review-issues">이 원본으로 저장한 기록이 {previousCount}개 있어요. 같은 판독 식별자는 다시 저장하지 않습니다. 다시 읽을 때 운동 표기가 달라질 수 있으니 기존 날짜·운동과도 비교해주세요.</p>}
   {!result.records.length&&<p className="file-empty">반복 횟수로 정리할 운동 기록을 찾지 못했어요. 아래 미분류 내용과 원본을 확인하거나 직접 입력해주세요.</p>}
   <ol className="ai-draft-list">{result.records.map((r,i)=><li key={r.id} className={saved.has(r.id)?'is-saved':''}><div><small>{r.input.sourcePage}쪽 · {r.input.date||'날짜 확인 필요'}</small><h3>{r.input.exerciseName||r.input.rawName||`운동 ${i+1}`}</h3><p>{r.input.sets.length}세트 · {r.input.bodyPart}{r.issues.length?` · 확인할 내용 ${r.issues.length}개`:''}</p>{r.issues[0]&&<p className="ai-draft-warning">{r.issues[0]}</p>}</div><button disabled={saved.has(r.id)||!online} onClick={()=>setEditor(r)}>{saved.has(r.id)?'저장 완료':'원본 대조·확인'}</button></li>)}</ol>
   {result.unparsed.length>0&&<div className="ai-review-issues"><strong>따로 확인할 원문 {result.unparsed.length}개</strong><p>이 항목은 kg·회 기록이나 통계로 자동 변환하지 않았어요.</p><ul>{result.unparsed.map((v,i)=><li key={i}><strong>{v.page}쪽 · {v.text}</strong><br/>{v.reason}</li>)}</ul></div>}
   <p className="record-help">초안은 이 화면에만 유지돼요. 확정한 기록은 저장되며, 확인하지 않은 값은 추이·볼륨 계산에 쓰지 않습니다.</p><div className="dialog-footer"><button onClick={close}>{remaining?'나중에 확인':'완료'}</button></div>
  </>}{error&&<p className="file-error" role="alert">{error}</p>}{!online&&<p className="file-error">인터넷 연결 후 판독·저장할 수 있어요.</p>}{discard&&<div className="ai-review-issues"><strong>확인하지 않은 초안 {remaining}개가 있어요.</strong><p>닫으면 남은 초안은 사라져요. 이미 확정한 기록은 유지됩니다.</p><div className="dialog-footer"><button onClick={()=>setDiscard(false)}>계속 확인</button><button onClick={onClose}>남은 초안 버리고 닫기</button></div></div>}
 </div></dialog>{editor&&blob&&<RecordEditor key={editor.id} memberId={memberId} memberName={memberName} initial={editor.input} sourceBlob={blob} issues={editor.issues} importId={editor.id} online={online} onClose={()=>setEditor(null)} onSaved={()=>{setSaved(v=>new Set([...v,editor.id]));setEditor(null);}}/>}</>;
}
