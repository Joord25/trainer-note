"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AccountControl, useTrainer } from "./auth-gate";
import { Icon } from "./icons";
import { MemberRecords } from "./member-records";
import { MemberFiles } from "./member-files";
import { cleanMember, createMember, editMember, listenMembers, memberError, removeMember, type Member, type MemberInput } from "../lib/members";

type Editor = { kind: "create" } | { kind: "edit"; member: Member } | { kind: "delete"; member: Member };

export function MemberWorkspace({onDemo}: {onDemo: () => void}) {
  const trainer = useTrainer();
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(true);
  const selected = members.find(m => m.id === selectedId) ?? members[0];

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
  const visible = members.filter(m => m.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const available = !loading && !error && online && !cached;

  return <div className="app-shell member-shell">
    <aside className="sidebar">
      <div className="brand-row"><span className="brand">trainer<span>note</span><i/></span></div>
      <button className="upload-nav" onClick={() => setEditor({kind: "create"})} disabled={!available} aria-label="회원 추가"><Icon name="plus"/><span>회원 추가</span></button>
      <div className="nav-label"><span>내 회원</span><span>{members.length}</span></div>
      <label className="member-search"><Icon name="search" size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="회원 검색" aria-label="회원 검색"/></label>
      <nav className="real-member-list" aria-label="회원 목록">{visible.map((m, i) => <button key={m.id} className={"member " + (selected?.id === m.id ? "active" : "")} onClick={() => setSelectedId(m.id)} aria-label={m.name + " 회원 보기"} aria-current={selected?.id === m.id ? "true" : undefined} title={m.name}>
        <span className={"avatar tone-" + i % 3}>{m.name.slice(0,1)}</span><span className="member-copy"><strong>{m.name}</strong><small>{m.pending ? "저장 중…" : m.goal || "목표를 설정해주세요"}</small></span>
      </button>)}</nav>
      {!loading && !error && !visible.length && members.length > 0 && <p className="member-search-empty">검색 결과가 없어요.</p>}
      <button className="member-demo-button" onClick={onDemo} title="예시 둘러보기"><Icon name="chart" size={17}/><span>예시 둘러보기</span></button>
      <AccountControl/>
    </aside>
    <main className="main-workspace real-main">
      <header className="topbar"><div className="breadcrumb"><Icon name="users" size={17}/><span>내 회원</span>{selected && <><span className="slash">/</span><strong>{selected.name}</strong></>}</div><span className="member-sync" role="status">{!online ? "오프라인" : cached ? "서버 연결 중" : "연결됨"}</span></header>
      <div className="real-content">
        {!online && <div className="member-notice" role="status">인터넷 연결을 확인해주세요. 다시 연결되면 회원 목록을 불러옵니다.</div>}
        {error ? <div className="member-error" role="alert"><h2>회원 목록을 불러오지 못했어요</h2><p>{error}</p><button onClick={() => setAttempt(v => v + 1)}>다시 시도</button></div> : loading ? <div className="empty-state" aria-busy="true"><span className="auth-spinner"/><p>{online ? "회원 정보를 불러오고 있어요." : "인터넷 연결을 기다리고 있어요."}</p></div> : !selected ? <section className="member-welcome">
          <span className="section-eyebrow">나의 첫 번째 회원</span><h1>회원부터 연결해볼까요?</h1><p>회원의 이름과 운동 목표를 등록하세요.<br/>다음 로그인에도 같은 회원 목록을 이어서 볼 수 있어요.</p>
          <button className="primary" onClick={() => setEditor({kind: "create"})} disabled={!available}><Icon name="plus" size={18}/> 첫 회원 등록하기</button>
          <button className="text-button" onClick={onDemo}>예시 화면 먼저 둘러보기 <Icon name="arrow" size={15}/></button>
        </section> : <>
          <div className="member-detail-heading"><div><span className="section-eyebrow">회원 프로필</span><h1>{selected.name}<span>님의 운동 기록</span></h1></div><button onClick={() => setEditor({kind: "edit", member: selected})} disabled={!available || selected.pending}><Icon name="edit" size={16}/> 정보 수정</button></div>
          {selected.pending && <div className="member-notice" role="status">변경 내용을 서버에 저장하고 있어요.</div>}
          <div className="member-profile-grid"><section className="member-info-card"><span className="section-eyebrow">운동 목표</span><h2>{selected.goal || "아직 목표를 설정하지 않았어요"}</h2><p>{selected.goal ? "앞으로 기록을 해석할 때 기준이 되는 목표예요." : "회원이 원하는 변화를 한 문장으로 남겨보세요."}</p></section><section className="member-info-card"><span className="section-eyebrow">트레이너 메모</span><p className="member-note-text">{selected.notes || "수업 준비에 필요한 내용을 남겨보세요."}</p><small>{selected.createdAt ? new Intl.DateTimeFormat("ko-KR").format(selected.createdAt.toDate()) + " 등록" : "등록 중"}</small></section></div>
          {selected.createdAt&&<><MemberRecords key={selected.id+"-records"} memberId={selected.id} memberName={selected.name} online={online}/>
          <MemberFiles key={selected.id} memberId={selected.id} memberName={selected.name} online={online}/></>}
          <div className="member-bottom-actions"><p>{(selected.fileCount > 0 || selected.recordCount > 0) ? "회원을 삭제하려면 연결된 파일과 운동 기록을 먼저 삭제해주세요." : "회원 정보는 로그인한 트레이너 계정에 저장돼요."}</p><button className="member-delete-button" onClick={() => setEditor({kind: "delete", member: selected})} disabled={!available || selected.pending || (selected.fileCount > 0 || selected.recordCount > 0)} title={(selected.fileCount || selected.recordCount) ? "연결된 파일과 운동 기록을 먼저 삭제해주세요." : undefined}>회원 삭제</button></div>
        </>}
      </div>
    </main>
    {editor && <MemberDialog editor={editor} online={online} onClose={() => setEditor(null)} onSaved={(id, message) => {if (id) {setSelectedId(id); setSearch("");} setEditor(null); setToast(message);}}/>}
    {toast && <div className="toast" role="status"><Icon name="check" size={17}/>{toast}</div>}
  </div>;
}

function MemberDialog({editor, online, onClose, onSaved}: {editor: Editor; online: boolean; onClose: () => void; onSaved: (id: string | null, message: string) => void}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState<MemberInput>(editor.kind === "create" ? {name: "", goal: "", notes: ""} : {name: editor.member.name, goal: editor.member.goal, notes: editor.member.notes});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {mounted.current = true; const previous = document.activeElement as HTMLElement | null; ref.current?.showModal(); return () => {mounted.current = false; previous?.focus();};}, []);
  async function submit(e: FormEvent) {
    e.preventDefault(); if (pending.current || !online) return;
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
      {editor.kind === "delete" ? <p><strong>{editor.member.name}</strong> 회원의 이름·목표·메모가 영구 삭제돼요. 이 작업은 되돌릴 수 없어요.</p> : <>
        <label className="field-label">회원 이름 <span>필수</span><input autoFocus required maxLength={60} value={input.name} onChange={e => setInput({...input, name: e.target.value})} disabled={busy} placeholder="예: 김민수"/></label>
        <label className="field-label">운동 목표 <span>선택</span><textarea maxLength={300} value={input.goal} onChange={e => setInput({...input, goal: e.target.value})} disabled={busy} placeholder="예: 주 2회 운동 습관 만들기" rows={2}/></label>
        <label className="field-label">트레이너 메모 <span>선택</span><textarea maxLength={1000} value={input.notes} onChange={e => setInput({...input, notes: e.target.value})} disabled={busy} placeholder="수업 준비에 참고할 내용" rows={3}/></label>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      {!online && <p className="member-notice" role="status">{busy ? "서버 저장을 기다리고 있어요. 인터넷을 연결해주세요." : "인터넷 연결 후 저장할 수 있어요."}</p>}
      {busy && <p role="status" className="caption">서버에서 처리 중이에요. 완료될 때까지 이 화면을 유지해주세요.</p>}
      <div className="dialog-footer"><button type="button" onClick={onClose} disabled={busy}>취소</button><button className={editor.kind === "delete" ? "member-danger" : "primary"} disabled={busy || !online}>{busy ? "처리 중…" : editor.kind === "delete" ? "회원 삭제" : "저장하기"}</button></div>
    </form>
  </dialog>;
}
