"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountControl, useTrainer } from "./auth-gate";
import { Icon } from "./icons";
import {SettingsDialog} from "./settings-dialog";
import {useDisplayPreferences} from "../lib/display-preferences";
import {MemberActions} from "./member-actions";
import {MemberDirectory} from "./member-directory";
import {LiveAnalysisWorkspace} from "./live-analysis-workspace";

import { cleanMember, createMember, editMember, listenMembers, memberError, removeMember, type Member, type MemberInput } from "../lib/members";

type Editor = { kind: "create" } | { kind: "edit"; member: Member } | { kind: "delete"; member: Member };

export function MemberWorkspace({onDemo}: {onDemo: () => void}) {
  const trainer = useTrainer();
  const {preferences,update:updatePreferences,error:preferenceError}=useDisplayPreferences(trainer.uid);
  const [settings,setSettings]=useState(false);
  const [narrow,setNarrow]=useState(false),[mobileSidebarOpen,setMobileSidebarOpen]=useState(false);
  const sidebarRef=useRef<HTMLElement>(null),sidebarToggleRef=useRef<HTMLButtonElement>(null);
  const compact=narrow?!mobileSidebarOpen:preferences.sidebarCollapsed;
  function closeMobileSidebar(){setMobileSidebarOpen(false);}
  function dismissSidebar(){setMobileSidebarOpen(false);sidebarToggleRef.current?.focus();}
  function toggleSidebar(){if(narrow)setMobileSidebarOpen(v=>!v);else updatePreferences({sidebarCollapsed:!preferences.sidebarCollapsed});}
  useEffect(()=>{const query=window.matchMedia('(max-width: 850px)');const sync=()=>{setNarrow(query.matches);setMobileSidebarOpen(false);};sync();query.addEventListener('change',sync);return()=>query.removeEventListener('change',sync);},[]);
  useEffect(()=>{
    if(!mobileSidebarOpen||!narrow)return;
    sidebarToggleRef.current?.focus();
    function keydown(event:KeyboardEvent){
      if(document.querySelector('dialog[open]'))return;
      if(event.key==='Escape'){event.preventDefault();setMobileSidebarOpen(false);sidebarToggleRef.current?.focus();}
      if(event.key!=='Tab')return;
      const items=Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),summary,[href]')||[]).filter(el=>el.getClientRects().length>0);
      const first=items[0],last=items[items.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
    }
    document.addEventListener('keydown',keydown);return()=>document.removeEventListener('keydown',keydown);
  },[mobileSidebarOpen,narrow]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [home,setHome]=useState(true);
  const unsaved=useRef(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const [uploadRequest,setUploadRequest]=useState(0);
  const selected = members.find(m => m.id === selectedId);
  const showHome=home||!selected;
  function openMember(id:string){if(selectedId!==id&&unsaved.current&&!window.confirm('저장하지 않은 수정 내용이 있어요. 버리고 다른 회원으로 이동할까요?'))return false;if(selectedId!==id){unsaved.current=false;setUploadRequest(0);}setSelectedId(id);setHome(false);closeMobileSidebar();return true;}
  function goHome(){setHome(true);setSearch('');closeMobileSidebar();}

  useEffect(() => {
    setLoading(true); setError("");
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = listenMembers((data, fromCache) => {setMembers(data); setCached(fromCache); if (!fromCache || data.length) setLoading(false);}, error => {setError(memberError(error)); setLoading(false); setMembers([]);});
    } catch (error) { setError(memberError(error)); setLoading(false); }
    return () => unsubscribe?.();
  }, [trainer.uid, attempt]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update(); window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => {window.removeEventListener("online", update); window.removeEventListener("offline", update);};
  }, []);
  useEffect(() => {if (!toast) return; const timer = setTimeout(() => setToast(""), 4000); return () => clearTimeout(timer);}, [toast]);
  const available = !loading && !error && online && !cached;

  return <div className={"app-shell member-shell "+(!showHome?"live-member-shell ":"")+(compact?"sidebar-compact ":"sidebar-expanded ")+(mobileSidebarOpen?"sidebar-mobile-open":"")}>
    {narrow&&mobileSidebarOpen&&<button className="sidebar-backdrop" tabIndex={-1} aria-label="사이드바 닫기" onClick={dismissSidebar}/>}
    <aside id="member-sidebar" ref={sidebarRef} className="sidebar" aria-label="주 메뉴" role={narrow&&mobileSidebarOpen?"dialog":undefined} aria-modal={narrow&&mobileSidebarOpen?true:undefined}>
      <div className="brand-row"><button className="brand" aria-label="회원 홈으로" title="회원 홈" onClick={goHome}><span className="brand-full">trainer<span>note</span><i/></span></button><button ref={sidebarToggleRef} className="sidebar-toggle icon-button" aria-label={compact?"사이드바 펼치기":"사이드바 접기"} title={compact?"사이드바 펼치기":"사이드바 접기"} aria-expanded={!compact} aria-controls="member-sidebar" onClick={toggleSidebar}><span className="toggle-monogram" aria-hidden="true">tn<i/></span><Icon name="panel" size={21}/></button></div>
      <button className="member-home-nav" aria-current={showHome?"page":undefined} onClick={goHome} title="회원 목록" aria-label="회원 목록"><Icon name="users" size={18}/><span>회원 목록</span></button>
      <nav className="real-member-list" aria-label="회원 목록">{members.map((m,i)=><div key={m.id} className={'sidebar-member-item '+(!showHome&&selectedId===m.id?'is-active':'')}><div className="sidebar-member-row"><button className="member" onClick={()=>openMember(m.id)} aria-label={m.name+' 회원 보기'} aria-current={!showHome&&selectedId===m.id?'true':undefined} title={m.name}><span className={'avatar tone-'+i%3}>{m.name.slice(0,1)}</span><span className="member-copy"><strong>{m.name}</strong><small>{m.pending?'저장 중…':m.goal||'목표 미설정'}</small></span></button><MemberActions member={m} compact={compact} available={available} online={online} onOpen={()=>openMember(m.id)} onEdit={()=>{closeMobileSidebar();setEditor({kind:'edit',member:m});}} onUpload={()=>{if(openMember(m.id))setUploadRequest(v=>v+1);}} onDelete={()=>{closeMobileSidebar();setEditor({kind:'delete',member:m});}}/></div></div>)}</nav>
      <button className="member-demo-button" onClick={()=>{if(!unsaved.current||window.confirm('저장하지 않은 수정 내용을 버리고 예시로 이동할까요?'))onDemo();}} title="예시 둘러보기" aria-label="예시 둘러보기"><Icon name="chart" size={17}/><span>예시 둘러보기</span></button>
      <AccountControl onSettings={()=>{closeMobileSidebar();setSettings(true);}}/>
    </aside>
    <main className="main-workspace real-main" inert={narrow&&mobileSidebarOpen}>

      <div className="real-content">
        {!online && <div className="member-notice" role="status">인터넷 연결을 확인해주세요. 다시 연결되면 회원 목록을 불러옵니다.</div>}
        {error ? <div className="member-error" role="alert"><h2>회원 목록을 불러오지 못했어요</h2><p>{error}</p><button onClick={() => setAttempt(v => v + 1)}>다시 시도</button></div> : loading ? <div className="empty-state" aria-busy="true"><span className="auth-spinner"/><p>{online ? "회원 정보를 불러오고 있어요." : "인터넷 연결을 기다리고 있어요."}</p></div> : <>
          {showHome&&<MemberDirectory onEdit={m=>setEditor({kind:'edit',member:m})} onDelete={m=>setEditor({kind:'delete',member:m})} onUpload={m=>{if(openMember(m.id))setUploadRequest(v=>v+1);}} online={online} preferences={preferences} onPreferences={updatePreferences} members={members} search={search} onSearch={setSearch} onOpen={openMember} onCreate={()=>setEditor({kind:"create"})} canCreate={available}/>}
          {selected&&<div className="member-session" hidden={showHome}>{selected.createdAt ? <LiveAnalysisWorkspace onBack={goHome} initialViewMode={preferences.viewMode} key={selected.id} memberId={selected.id} memberName={selected.name} goal={selected.goal} online={online} uploadRequest={uploadRequest} onUnsavedChange={v=>{unsaved.current=v;}}/> : <div className="empty-state" role="status">회원 정보를 저장하고 있어요.</div>}</div>}
        </>}

      </div>
    </main>
    <SettingsDialog open={settings} onClose={()=>setSettings(false)} preferences={preferences} onChange={updatePreferences} saveError={preferenceError} beforeLogout={()=>!unsaved.current||window.confirm('저장하지 않은 수정 내용이 있어요. 로그아웃할까요?')}/>
    {editor && <MemberDialog editor={editor} online={online} onClose={() => setEditor(null)} onSaved={(id, message) => {if (id) {openMember(id); setSearch("");} else if(editor.kind==='delete'&&selectedId===editor.member.id){setSelectedId('');setHome(true);unsaved.current=false;} setEditor(null); setToast(message);}}/>}
    {toast && <div className="toast" role="status"><Icon name="check" size={17}/>{toast}</div>}
  </div>;
}

function MemberDialog({editor, online, onClose, onSaved}: {editor: Editor; online: boolean; onClose: () => void; onSaved: (id: string | null, message: string) => void}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState<MemberInput>(editor.kind === "create" ? {name: "", goal: "", notes: ""} : {name: editor.member.name, goal: editor.member.goal, notes: editor.member.notes});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const blockedDelete=editor.kind==='delete'&&(editor.member.fileCount>0||editor.member.recordCount>0);
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => {mounted.current = false; previous?.focus();};}, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (pending.current || !online || blockedDelete) return;
    if (editor.kind !== "delete") {try {cleanMember(input);} catch (e) {setError((e as Error).message); return;}}
    pending.current = true; setBusy(true); setError("");
    try {
      if (editor.kind === "delete") {await removeMember(editor.member.id); if (mounted.current) onSaved(null, "회원 정보를 삭제했어요.");}
      else {const id = editor.kind === "create" ? await createMember(input) : (await editMember(editor.member.id, input), editor.member.id); if (mounted.current) onSaved(id, "회원 정보를 저장했어요.");}
    } catch (e) {if (mounted.current) setError(memberError(e));}
    finally {pending.current = false; if (mounted.current) setBusy(false);}
  }
  return <dialog ref={ref} className="upload-dialog member-dialog" onCancel={e => {e.preventDefault(); if (!busy) onClose();}}>
    <form onSubmit={e => void submit(e)}>
      <div className="dialog-title"><div><span className="section-eyebrow">내 회원 관리</span><h2>{editor.kind === "create" ? "새 회원 등록" : editor.kind === "edit" ? "회원 정보 수정" : "회원을 삭제할까요?"}</h2></div><button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="닫기"><Icon name="close"/></button></div>
      {editor.kind === "delete" ? <><p><strong>{editor.member.name}</strong> 회원의 이름·목표·메모가 영구 삭제돼요. 이 작업은 되돌릴 수 없어요.</p>{blockedDelete&&<p className="member-notice">일지 {editor.member.fileCount}개·운동 기록 {editor.member.recordCount}개가 연결되어 있어요. 연결된 파일과 기록을 먼저 삭제해주세요.</p>}</> : <>
        <label className="field-label">회원 이름 <span>필수</span><input autoFocus required maxLength={60} value={input.name} onChange={e => setInput({...input, name: e.target.value})} disabled={busy} placeholder="예: 김민수"/></label>
        <label className="field-label">운동 목표 <span>선택</span><textarea maxLength={300} value={input.goal} onChange={e => setInput({...input, goal: e.target.value})} disabled={busy} placeholder="예: 주 2회 운동 습관 만들기" rows={2}/></label>
        <label className="field-label">트레이너 메모 <span>선택</span><textarea maxLength={1000} value={input.notes} onChange={e => setInput({...input, notes: e.target.value})} disabled={busy} placeholder="수업 준비에 참고할 내용" rows={3}/></label>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      {!online && <p className="member-notice" role="status">{busy ? "서버 저장을 기다리고 있어요. 인터넷을 연결해주세요." : "인터넷 연결 후 저장할 수 있어요."}</p>}
      {busy && <p role="status" className="caption">서버에서 처리 중이에요. 완료될 때까지 이 화면을 유지해주세요.</p>}
      <div className="dialog-footer"><button type="button" onClick={onClose} disabled={busy}>취소</button><button className={editor.kind === "delete" ? "member-danger" : "primary"} disabled={busy || !online || blockedDelete}>{busy ? "처리 중…" : editor.kind === "delete" ? "회원 삭제" : "저장하기"}</button></div>
    </form>
  </dialog>;
}
