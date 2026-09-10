"use client";
import {useEffect,useRef,useState} from "react";
import {Icon} from "./icons";
import {deleteMemberPdf,fileError,finalizeMemberPdf,listenMemberFiles,readMemberPdf,storageEnabled,uploadMemberPdf,type MemberFile} from "../lib/member-files";

export function MemberFiles({memberId,memberName,online}:{memberId:string;memberName:string;online:boolean}) {
  const [files,setFiles]=useState<MemberFile[]>([]),[loading,setLoading]=useState(storageEnabled),[cached,setCached]=useState(true),[error,setError]=useState(""),[notice,setNotice]=useState(""),[retry,setRetry]=useState(0);
  const [upload,setUpload]=useState<{name:string;progress:number;index:number;total:number}|null>(null),[busy,setBusy]=useState(""),[remove,setRemove]=useState<MemberFile|null>(null),[preview,setPreview]=useState<{id:string;name:string;url:string}|null>(null),[drag,setDrag]=useState(false);
  const picker=useRef<HTMLInputElement>(null),controller=useRef<AbortController|null>(null),alive=useRef(true),working=useRef(false),previewUrl=useRef("");
  function closePreview(){if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);previewUrl.current="";setPreview(null);}
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;controller.current?.abort();if(previewUrl.current)URL.revokeObjectURL(previewUrl.current);};},[]);
  useEffect(()=>{
    if(!storageEnabled)return;
    setLoading(true);setError("");
    try{return listenMemberFiles(memberId,(data,fromCache)=>{setFiles(data);setCached(fromCache);if(!fromCache||data.length)setLoading(false);},e=>{setError(fileError(e));setLoading(false);setCached(true);setFiles([]);});}
    catch(e){setError(fileError(e));setLoading(false);}
  },[memberId,retry]);
  useEffect(()=>{if(preview&&!files.some(f=>f.id===preview.id&&f.status==='ready'))closePreview();},[files,preview]);
  const enabled=storageEnabled&&online&&!loading&&!cached&&!upload&&!busy;
  async function add(list:File[]){
    if(!enabled||working.current||!list.length)return;
    if(list.length>10){setError("한 번에 PDF 10개까지 선택해주세요.");return;}
    working.current=true;setError("");setNotice("");
    const abort=new AbortController();controller.current=abort;
    let count=0;const errors:string[]=[];
    for(let i=0;i<list.length;i++){
      if(abort.signal.aborted||!alive.current)break;
      const file=list[i];setUpload({name:file.name,progress:0,index:i+1,total:list.length});
      try{await uploadMemberPdf(memberId,file,value=>{if(alive.current)setUpload({name:file.name,progress:value,index:i+1,total:list.length});},abort.signal);count++;}
      catch(e){errors.push(file.name+": "+fileError(e));}
    }
    working.current=false;controller.current=null;
    if(alive.current){setUpload(null);setError(errors.join("\n"));if(count)setNotice(`${count}개 PDF를 저장했어요.`);}
  }
  async function act(file:MemberFile,action:"open"|"recover"|"delete"){
    if(working.current||!online)return;
    working.current=true;setBusy(file.id);setError("");setNotice("");
    try{
      if(action==='open'){
        const blob=await readMemberPdf(memberId,file.id);
        if(alive.current){closePreview();const url=URL.createObjectURL(blob);previewUrl.current=url;setPreview({id:file.id,name:file.name,url});}
      }else if(action==='recover'){await finalizeMemberPdf(memberId,file.id);if(alive.current)setNotice("서버의 PDF 저장을 확인했어요.");}
      else{await deleteMemberPdf(memberId,file.id);if(alive.current){setRemove(null);setNotice("PDF를 삭제했어요.");}}
    }catch(e){if(alive.current)setError(fileError(e));}
    finally{working.current=false;if(alive.current)setBusy("");}
  }
  return <section className="member-files" aria-label="회원 운동일지">
    <div className="file-section-heading"><div><h2>운동일지 <span>{files.length}</span></h2><p>{memberName} 회원에게 연결된 원본 PDF예요.</p></div><button className="primary" disabled={!enabled} onClick={()=>picker.current?.click()}><Icon name="plus" size={16}/> PDF 추가</button></div>
    <input ref={picker} type="file" accept=".pdf,application/pdf" multiple hidden aria-label="PDF 파일 선택" onChange={e=>{void add(Array.from(e.target.files??[]));e.target.value="";}}/>
    {!storageEnabled?<div className="file-service-note"><Icon name="file" size={24}/><h3>PDF 저장 기능을 준비하고 있어요</h3><p>회원 정보는 저장할 수 있어요. 파일 저장이 준비되면 이곳에서 일지를 추가할 수 있습니다.</p></div>:<>
      <button className={"file-drop "+(drag?"dragging":"")} disabled={!enabled} onClick={()=>picker.current?.click()} onDragOver={e=>{e.preventDefault();if(enabled)setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void add(Array.from(e.dataTransfer.files));}}><Icon name="upload" size={24}/><span><strong>PDF를 선택하거나 여기로 끌어오세요</strong><small>파일당 최대 50MB · 한 번에 10개 · 같은 파일은 중복 저장하지 않아요</small></span></button>
      {upload&&<div className="file-upload-progress" role="status"><div><strong>{upload.index}/{upload.total} · {upload.name}</strong><span>{upload.progress}%</span><button onClick={()=>controller.current?.abort()}>중단</button></div><progress value={upload.progress} max={100}/><small>{upload.progress===100?"서버 저장을 확인하고 있어요.":"화면을 이동하면 업로드가 중단됩니다."}</small></div>}
      {loading?<p className="file-empty" role="status">{online?"일지 목록을 불러오고 있어요.":"인터넷 연결을 기다리고 있어요."}</p>:!files.length?<p className="file-empty">아직 연결된 운동일지가 없어요.</p>:<ul className="saved-file-list">{files.map(file=><li key={file.id}><div className="file-pdf-icon"><Icon name="file" size={21}/><span>PDF</span></div><div className="saved-file-copy"><strong>{file.name}</strong><small>{file.size<1024*1024?`${Math.max(1,Math.round(file.size/1024))} KB`:`${(file.size/1024/1024).toFixed(1)} MB`} · {file.status==='ready'?'저장 완료':file.status==='deleting'?'삭제 마무리 필요':'저장 확인 필요'}{file.pending?' · 동기화 중':''}</small></div><div className="saved-file-actions">{file.status==='ready'?<button disabled={!enabled||file.pending} onClick={()=>void act(file,'open')}>{busy===file.id?'처리 중…':'열기'}</button>:file.status==='uploading'?<button disabled={!enabled||file.pending} onClick={()=>void act(file,'recover')}>저장 확인</button>:null}<button disabled={!enabled||file.pending} aria-label={file.name+" 삭제"} onClick={()=>{closePreview();setRemove(file);}}>삭제</button></div></li>)}</ul>}
    </>}
    {error&&<div className="file-error" role="alert"><p>{error}</p>{!upload&&!busy&&<button onClick={()=>setRetry(v=>v+1)}>목록 새로고침</button>}</div>}
    {notice&&<p className="file-notice" role="status">{notice}</p>}
    <p className="file-analysis-note">이 단계에서는 원본 파일을 저장해요. 기록 판독·운동 분석은 다음 단계에서 연결됩니다.</p>
    {preview&&<FileDialog title={preview.name} onClose={closePreview} large><iframe title={preview.name+" PDF 미리보기"} src={preview.url}/><div className="dialog-footer"><a href={preview.url} download={preview.name}>PDF 내려받기</a><button onClick={closePreview}>닫기</button></div></FileDialog>}
    {remove&&<FileDialog title="PDF를 삭제할까요?" onClose={()=>setRemove(null)} busy={!!busy}><p><strong>{remove.name}</strong> 원본 파일과 연결 정보가 영구 삭제됩니다.</p>{error&&<p className="file-error" role="alert">{error}</p>}<div className="dialog-footer"><button disabled={!!busy} onClick={()=>setRemove(null)}>취소</button><button className="member-danger" disabled={!!busy||!online} onClick={()=>void act(remove,'delete')}>{busy?"삭제 중…":"PDF 삭제"}</button></div></FileDialog>}
  </section>;
}
function FileDialog({title,onClose,busy=false,large=false,children}:{title:string;onClose:()=>void;busy?:boolean;large?:boolean;children:React.ReactNode}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
  return <dialog ref={dialog} className={"upload-dialog file-dialog "+(large?"file-viewer":"")} onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><div className="dialog-title"><h2>{title}</h2><button className="icon-button" aria-label="닫기" disabled={busy} onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;
}
