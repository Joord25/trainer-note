"use client";
import {collection, doc, getFirestore, onSnapshot, orderBy, query, runTransaction, serverTimestamp, type Timestamp} from "firebase/firestore";
import {deleteObject, getBlob, getMetadata, getStorage, ref, uploadBytesResumable} from "firebase/storage";
import {getClientAuth} from "./firebase-client";

export const MAX_PDF_BYTES = 50 * 1024 * 1024;
export const storageEnabled = process.env.NEXT_PUBLIC_STORAGE_ENABLED === "true";
export type MemberFile = {id: string; name: string; size: number; status: "uploading" | "ready" | "deleting"; createdAt: Timestamp | null; pending: boolean};
class FileActionError extends Error {}
function scope(memberId: string, fileId?: string) {
  const auth = getClientAuth(), uid = auth.currentUser?.uid;
  if (!uid) throw new FileActionError("다시 로그인해주세요.");
  const db = getFirestore(auth.app), storage = getStorage(auth.app);
  const member = doc(db, "trainers", uid, "members", memberId);
  const files = collection(member, "files");
  return {db, member, files, file: fileId ? doc(files, fileId) : undefined,
    object: fileId ? ref(storage, `${member.path}/files/${fileId}/source.pdf`) : undefined,
    check: () => {if (auth.currentUser?.uid !== uid) throw new FileActionError("로그인 계정이 변경됐어요. 다시 시도해주세요.");}};
}
export function listenMemberFiles(memberId: string, onData: (files: MemberFile[], cached: boolean) => void, onError: (error: unknown) => void) {
  const s = scope(memberId);
  return onSnapshot(query(s.files, orderBy("createdAt", "desc")), {includeMetadataChanges: true}, snapshot => onData(snapshot.docs.map(d => ({id:d.id, name:d.data().name, size:d.data().size, status:d.data().status, createdAt:d.data().createdAt ?? null, pending:d.metadata.hasPendingWrites})), snapshot.metadata.fromCache), onError);
}
export async function inspectPdf(file: File) {
  if (!/\.pdf$/i.test(file.name) || !file.size || file.size > MAX_PDF_BYTES) throw new FileActionError("0바이트가 아닌 50MB 이하 PDF를 선택해주세요.");
  if (file.name.length > 200) throw new FileActionError("파일 이름을 200자 이내로 줄여주세요.");
  const bytes = await file.arrayBuffer();
  if (new TextDecoder().decode(bytes.slice(0,5)) !== "%PDF-") throw new FileActionError("PDF 형식의 파일이 아니에요. PDF로 내보낸 파일을 선택해주세요.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2,"0")).join("");
}
export async function uploadMemberPdf(memberId: string, file: File, progress: (value: number) => void, signal: AbortSignal) {
  if (!storageEnabled) throw new FileActionError("파일 저장 기능을 준비하고 있어요.");
  const initial = scope(memberId);
  const id = await inspectPdf(file);
  initial.check(); signal.throwIfAborted();
  const s = scope(memberId,id);
  await runTransaction(s.db, async tx => {
    const member = await tx.get(s.member), existing = await tx.get(s.file!);
    if (!member.exists()) throw new FileActionError("회원이 삭제됐어요. 목록을 다시 확인해주세요.");
    if (existing.exists()) throw new FileActionError("이미 연결된 PDF예요. 저장 확인이 필요한 파일은 목록에서 확인해주세요.");
    tx.set(s.file!, {name:file.name, size:file.size, contentType:"application/pdf", status:"uploading", createdAt:serverTimestamp(), updatedAt:serverTimestamp()});
    tx.update(s.member, {fileCount:(member.data().fileCount ?? 0)+1, lastFileId:id, updatedAt:serverTimestamp()});
  });
  s.check(); signal.throwIfAborted();
  const task = uploadBytesResumable(s.object!, file, {contentType:"application/pdf",cacheControl:"private, max-age=0, no-store"});
  const cancel = () => task.cancel(); signal.addEventListener("abort",cancel,{once:true});
  try {
    await new Promise<void>((resolve,reject) => {task.on("state_changed", snapshot => progress(Math.round(snapshot.bytesTransferred/snapshot.totalBytes*100)), reject, () => resolve());});
    s.check(); signal.throwIfAborted();
    await finalizeMemberPdf(memberId,id);
  } finally {signal.removeEventListener("abort",cancel);}
  return id;
}
export async function finalizeMemberPdf(memberId: string, id: string) {
  const s = scope(memberId,id), metadata = await getMetadata(s.object!);
  s.check();
  await runTransaction(s.db, async tx => {
    const existing = await tx.get(s.file!);
    if (!existing.exists() || existing.data().status === "deleting") throw new FileActionError("삭제된 파일이거나 삭제 중이에요.");
    if (metadata.size !== existing.data().size || metadata.contentType !== "application/pdf") throw new FileActionError("파일 정보를 확인할 수 없어요. 삭제 후 다시 올려주세요.");
    tx.update(s.file!,{status:"ready",updatedAt:serverTimestamp()});
  });
}
export async function readMemberPdf(memberId: string, id: string) {
  const s = scope(memberId,id), blob = await getBlob(s.object!, MAX_PDF_BYTES);
  s.check();
  return new Blob([blob],{type:"application/pdf"});
}
export async function deleteMemberPdf(memberId: string, id: string) {
  const s = scope(memberId,id);
  await runTransaction(s.db, async tx => {
    const existing = await tx.get(s.file!);
    if (existing.exists()) tx.update(s.file!,{status:"deleting",updatedAt:serverTimestamp()});
  });
  s.check();
  try {await deleteObject(s.object!);} catch (error) {if ((error as {code?:string}).code !== "storage/object-not-found") throw error;}
  s.check();
  await runTransaction(s.db, async tx => {
    const existing = await tx.get(s.file!), member = await tx.get(s.member);
    if (!existing.exists()) return;
    if (!member.exists()) throw new FileActionError("회원 정보를 확인할 수 없어요.");
    tx.delete(s.file!);
    tx.update(s.member,{fileCount:(member.data().fileCount ?? 0)-1,lastFileId:id,updatedAt:serverTimestamp()});
  });
}
export function fileError(error: unknown) {
  if (error instanceof FileActionError) return error.message;
  const code = (error as {code?:string})?.code;
  if (code === "storage/object-not-found") return "파일 업로드가 완료되지 않았어요. 이 항목을 삭제한 뒤 다시 올려주세요.";
  if (code === "storage/canceled" || (error instanceof DOMException && error.name === "AbortError")) return "업로드를 중단했어요. 목록에서 저장 상태를 확인하거나 삭제할 수 있어요.";
  if (code === "storage/unauthorized" || code === "permission-denied") return "파일에 접근할 수 없어요. 로그인 계정과 회원 정보를 확인해주세요.";
  if (code === "storage/no-default-bucket" || code === "storage/bucket-not-found" || code === "storage/project-not-found") return "파일 저장 서비스를 준비하고 있어요. 잠시 후 다시 시도해주세요.";
  if (code === "storage/quota-exceeded") return "현재 파일 저장 한도에 도달했어요. 서비스 관리자에게 문의해주세요.";
  return "파일을 처리하지 못했어요. 연결을 확인하고 다시 시도해주세요. 중단된 업로드는 목록에서 저장 상태를 확인할 수 있어요.";
}
