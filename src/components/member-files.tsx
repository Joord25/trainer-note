"use client";
import {useEffect,useRef,useState} from "react";
import {SavedRecordImport} from "./saved-record-import";
import {serverAiEnabled,listenImports,type SavedImport} from "../lib/server-ai";
import {AiRecordImport} from "./ai-record-import";
import {aiEnabled} from "../lib/workout-ai";
import {Icon} from "./icons";
import {deleteMemberFile,fileError,finalizeMemberFile,listenMemberFiles,readMemberFile,storageEnabled,uploadMemberFile,type MemberFile} from "../lib/member-files";

export function MemberFiles({memberId,memberName,online,onUploaded}:{memberId:string;memberName:string;online:boolean;onUploaded?:(id:string,result:{uploaded:number;failed:number})=>void}) {
  const [files,setFiles]=useState<MemberFile[]>([]),[loading,setLoading]=useState(storageEnabled),[cached,setCached]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[retry,setRetry]=useState(0);
  const [upload,setUpload]=useState<{name:string;progress:number;index:number;total:number}|null>(null),[busy,setBusy]=useState(""),[remove,setRemove]=useState<MemberFile[]|null>(null),[preview,setPreview]=useState<MemberFile[]|null>(null),[drag,setDrag]=useState(false);
  const [selected,setSelected]=useState<Set<string>>(new Set()),[deleteProgress,setDeleteProgress]=useState<{done:number;total:number}|null>(null);
  const selectAll=useRef<HTMLInputElement>(null);
  const [imports,setImports]=useState<SavedImport[]>([]);
  useEffect(()=>{if(!serverAiEnabled)return;try{return listenImports(memberId,setImports,e=>setError(fileError(e)));}catch(e){setError(fileError(e));}},[memberId]);
  const [aiFile,setAiFile]=useState<MemberFile|null>(null);
  const picker=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),alive=useRef(true),working=useRef(false);
  function closePreview(){setPreview(null);}
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();};},[]);
  useEffect(()=>{
    if(!storageEnabled)return;
    setLoading(true);setError("");
    try{return listenMemberFiles(memberId,(data,fromCache)=>{setFiles(data);setCached(fromCache);if(!fromCache||data.length)setLoading(false);},e=>{setError(fileError(e));setLoading(false);setCached(true);setFiles([]);});}
    catch(e){setError(fileError(e));setLoading(false);}
  },[memberId,retry]);
  useEffect(()=>{setSelected(previous=>new Set([...previous].filter(id=>files.some(f=>f.id===id))));},[files]);
  const selectable=files.filter(f=>!f.pending),chosen=selectable.filter(f=>selected.has(f.id));
  const allSelected=selectable.length>0&&chosen.length===selectable.length;
  useEffect(()=>{if(selectAll.current)selectAll.current.indeterminate=chosen.length>0&&!allSelected;},[chosen.length,allSelected]);
  function toggle(id:string){setSelected(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}

  const enabled=storageEnabled&&online&&!loading&&!cached&&!upload&&!busy&&!aiFile;
  async function add(list:File[]){
    if(!enabled||working.current||!list.length)return;
    if(list.length>10){setError("한 번에 파일 10개까지 선택해주세요.");return;}
    working.current=true;setError("");setNotice("");
    const abort=new AbortController();controller.current=abort;
    let count=0,lastId='';const errors:string[]=[];
    for(let i=0;i<list.length;i++){
      if(abort.signal.aborted||!alive.current)break;
      const file=list[i];setUpload({name:file.name,progress:0,index:i+1,total:list.length});
      try{lastId=await uploadMemberFile(memberId,file,value=>{if(alive.current)setUpload({name:file.name,progress:value,index:i+1,total:list.length});},abort.signal);count++;}
      catch(e){errors.push(file.name+": "+fileError(e));}
    }
    working.current=false;controller.current=null;
    if(alive.current){setUpload(null);setError(errors.join("\n"));if(count){setNotice(`${count}개 파일을 저장했어요.`);onUploaded?.(lastId,{uploaded:count,failed:errors.length});}}
  }
  async function recover(file:MemberFile){
    if(working.current||!enabled)return;
    working.current=true;setBusy(file.id);setError("");setNotice("");
    try{await finalizeMemberFile(memberId,file.id,file.contentType);if(alive.current)setNotice("서버의 파일 저장을 확인했어요.");}
    catch(e){if(alive.current)setError(fileError(e));}
    finally{working.current=false;if(alive.current)setBusy("");}
  }
  async function deleteSelected(){
    if(!remove?.length||working.current||!enabled)return;
    const targets=[...remove],failed:MemberFile[]=[],errors:string[]=[];
    working.current=true;setBusy("delete");setError("");setNotice("");setDeleteProgress({done:0,total:targets.length});
    let deleted=0;
    for(const [index,file] of targets.entries()){
      if(!alive.current)break;
      try{await deleteMemberFile(memberId,file.id,file.contentType);deleted++;if(alive.current)setSelected(previous=>{const next=new Set(previous);next.delete(file.id);return next;});}
      catch(e){failed.push(file);errors.push(`${file.name}: ${fileError(e)}`);}
      if(alive.current)setDeleteProgress({done:index+1,total:targets.length});
    }
    working.current=false;
    if(alive.current){setBusy("");setDeleteProgress(null);setRemove(null);setError(errors.join("\n"));setNotice(`${deleted}개 파일을 삭제했어요.${failed.length?` ${failed.length}개는 삭제하지 못했어요. 선택 삭제로 다시 시도해주세요.`:""}`);setSelected(previous=>new Set([...previous,...failed.map(f=>f.id)]));}
  }
  return <section className="member-files" aria-label="회원 운동일지">
    <div className="file-section-heading"><div><h2>운동일지 <span>{files.length}</span></h2><p>{memberName} 회원에게 연결된 원본 파일이에요.{serverAiEnabled&&' 업로드하면 Google Gemini로 자동 판독합니다.'}</p></div><button className="primary" disabled={!enabled} onClick={()=>picker.current?.click()}><Icon name="plus" size={16}/> 파일 추가</button></div>
    <input ref={picker} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple hidden aria-label="운동일지 파일 선택" onChange={e=>{void add(Array.from(e.target.files??[]));e.target.value="";}}/>
    {!storageEnabled?<div className="file-service-note"><Icon name="file" size={24}/><h3>파일 저장 기능을 준비하고 있어요</h3><p>회원 정보는 저장할 수 있어요. 파일 저장이 준비되면 이곳에서 일지를 추가할 수 있습니다.</p></div>:<>
      <button className={"file-drop "+(drag?"dragging":"")} disabled={!enabled} onClick={()=>picker.current?.click()} onDragOver={e=>{e.preventDefault();if(enabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void add(Array.from(e.dataTransfer.files));}}><Icon name="upload" size={24}/><span><strong>PDF·PNG·JPEG를 선택하거나 여기로 끌어오세요</strong><small>파일당 최대 50MB · 한 번에 10개 · 같은 파일은 중복 저장하지 않아요</small></span></button>
      {upload&&<div className="file-upload-progress" role="status"><div><strong>{upload.index}/{upload.total} · {upload.name}</strong><span>{upload.progress}%</span><button onClick={()=>controller.current?.abort()}>중단</button></div><progress value={upload.progress} max={100}/><small>{upload.progress===100?"서버 저장을 확인하고 있어요.":"화면을 이동하면 업로드가 중단됩니다."}</small></div>}
      {loading?<p className="file-empty" role="status">{online?"일지 목록을 불러오고 있어요.":"인터넷 연결을 기다리고 있어요."}</p>:!files.length?<p className="file-empty">아직 연결된 운동일지가 없어요.</p>:<><div className="file-selection-bar"><label className="file-check"><input ref={selectAll} type="checkbox" aria-label="파일 전체 선택" checked={allSelected} disabled={!enabled||!selectable.length} onChange={()=>setSelected(allSelected?new Set():new Set(selectable.map(f=>f.id)))}/>전체 선택</label><span role="status">{chosen.length}개 선택</span><div className="file-bulk-actions"><button disabled={!enabled||!chosen.length||chosen.some(f=>f.status!=="ready")} title={chosen.some(f=>f.status!=="ready")?"저장 완료된 파일만 함께 열 수 있어요.":undefined} onClick={()=>setPreview(chosen)}>선택 열기</button><button className="file-bulk-delete" disabled={!enabled||!chosen.length} onClick={()=>{setError("");setRemove(chosen);}}>선택 삭제</button>{chosen.length>0&&<button disabled={!enabled} onClick={()=>setSelected(new Set())}>선택 해제</button>}</div></div><ul className="saved-file-list">{files.map(file=><li key={file.id} className={selected.has(file.id)?"is-selected":""}><label className="file-check"><input type="checkbox" aria-label={file.name+" 선택"} checked={selected.has(file.id)} disabled={!enabled||file.pending} onChange={()=>toggle(file.id)}/></label><div className="file-pdf-icon"><Icon name="file" size={21}/><span>{file.contentType==='application/pdf'?'PDF':file.contentType==='image/png'?'PNG':'JPEG'}</span></div><div className="saved-file-copy"><strong>{file.name}</strong><small>{file.size<1024*1024?`${Math.max(1,Math.round(file.size/1024))} KB`:`${(file.size/1024/1024).toFixed(1)} MB`} · {file.status==='ready'?'저장 완료':file.status==='deleting'?'삭제 마무리 필요':'저장 확인 필요'}{file.pending?' · 동기화 중':''}</small></div><div className="saved-file-actions">{!onUploaded&&(aiEnabled||serverAiEnabled)&&file.status==='ready'&&<button disabled={!enabled||file.pending} onClick={()=>setAiFile(file)}>{serverAiEnabled?({ready:'기록 보기',processing:'판독 중',error:'판독 확인',limited:'한도 확인'}[imports.find(i=>i.id===file.id)?.status??'ready']):'AI로 읽기'}</button>}{file.status==='ready'?<button disabled={!enabled||file.pending} onClick={()=>setPreview([file])}>{busy===file.id?'처리 중…':'열기'}</button>:file.status==='uploading'?<button disabled={!enabled||file.pending} onClick={()=>void recover(file)}>저장 확인</button>:null}<button disabled={!enabled||file.pending} aria-label={file.name+" 삭제"} onClick={()=>{setError("");setRemove([file]);}}>삭제</button></div></li>)}</ul></>}
    </>}
    {error&&<div className="file-error" role="alert"><p>{error}</p>{!upload&&!busy&&<button onClick={()=>setRetry(v=>v+1)}>목록 새로고침</button>}</div>}
    {notice&&<p className="file-notice" role="status">{notice}</p>}
    <p className="file-analysis-note">{onUploaded?'업로드가 끝나면 원본과 진행 분석 화면으로 자동 이동해요.':serverAiEnabled?'업로드한 원본은 Google Gemini로 자동 판독해요(최대 10MB). 불확실한 항목만 확인하고 진행 분석·수업 초안을 바로 볼 수 있어요.':'저장한 일지는 ‘AI로 읽기’로 초안을 만들 수 있어요. 원본과 대조해 확정한 기록이 회원의 운동 통계에 반영됩니다.'}</p>
    {aiFile&&serverAiEnabled&&<SavedRecordImport file={aiFile} memberId={memberId} memberName={memberName} online={online} onClose={()=>setAiFile(null)}/>}
    {aiFile&&!serverAiEnabled&&<AiRecordImport file={aiFile} memberId={memberId} memberName={memberName} online={online} onClose={()=>setAiFile(null)}/>}
    {preview&&<FilePreview memberId={memberId} files={preview} onClose={closePreview}/>}
    {remove&&<FileDialog title={`${remove.length}개 파일을 삭제할까요?`} onClose={()=>setRemove(null)} busy={!!busy}><p>선택한 원본 파일과 연결 정보가 영구 삭제됩니다. 삭제 후에는 되돌릴 수 없어요.</p><ul className="file-delete-list">{remove.map(file=><li key={file.id}>{file.name}</li>)}</ul>{deleteProgress&&<div className="file-delete-progress" role="status"><p>{deleteProgress.done}/{deleteProgress.total}개 처리 중…</p><progress value={deleteProgress.done} max={deleteProgress.total}/></div>}<div className="dialog-footer"><button disabled={!!busy} onClick={()=>setRemove(null)}>취소</button><button className="member-danger" disabled={!enabled} onClick={()=>void deleteSelected()}>{busy?"삭제 중…":`${remove.length}개 파일 삭제`}</button></div></FileDialog>}

  </section>;
}
function FileDialog({title,onClose,busy=false,large=false,children}:{title:string;onClose:()=>void;busy?:boolean;large?:boolean;children:React.ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
  return <dialog ref={dialog} className={"upload-dialog file-dialog "+(large?"file-viewer":"")} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><div className="dialog-title"><h2>{title}</h2><button className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;
}

function FilePreview({memberId,files,onClose}:{memberId:string;files:MemberFile[];onClose:()=>void}){
  const [index,setIndex]=useState(0),[retry,setRetry]=useState(0);
  const [result,setResult]=useState<{id:string;url:string}|null>(null),[error,setError]=useState("");
  const file=files[index];
  useEffect(()=>{
    let cancelled=false,url="";setResult(null);setError("");
    readMemberFile(memberId,file.id,file.contentType).then(blob=>{
      if(cancelled)return;
      url=URL.createObjectURL(blob);setResult({id:file.id,url});
    }).catch(e=>{if(!cancelled)setError(fileError(e));});
    return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
  },[memberId,file.id,file.contentType,retry]);
  const url=result?.id===file.id?result.url:null;
  return <FileDialog title={file.name} onClose={onClose} large>
    {files.length>1&&<nav className="file-preview-nav" aria-label="선택 파일 탐색"><button disabled={index===0} onClick={()=>setIndex(i=>i-1)}>이전</button><label><span>{index+1} / {files.length}</span><select aria-label="미리보기 파일 선택" value={index} onChange={e=>setIndex(Number(e.target.value))}>{files.map((f,i)=><option key={f.id} value={i}>{f.name}</option>)}</select></label><button disabled={index===files.length-1} onClick={()=>setIndex(i=>i+1)}>다음</button></nav>}
    {error?<div className="file-preview-message" role="alert"><p>{error}</p><button onClick={()=>setRetry(i=>i+1)}>다시 열기</button></div>:!url?<div className="file-preview-message" role="status">파일을 불러오고 있어요.</div>:file.contentType==='application/pdf'?<iframe title={file.name+" PDF 미리보기"} src={url}/>:<div className="file-image-preview"><img src={url} alt={file.name+" 이미지 미리보기"}/></div>}
    <div className="dialog-footer">{url&&<a href={url} download={file.name}>파일 내려받기</a>}<button onClick={onClose}>닫기</button></div>
  </FileDialog>;
}
