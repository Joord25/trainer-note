"use client";

import { collection, deleteDoc, doc, getFirestore, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, type Timestamp } from "firebase/firestore";
import { getClientAuth } from "./firebase-client";

export type MemberInput = { name: string; goal: string; notes: string };
export type Member = MemberInput & { id: string; createdAt: Timestamp | null; pending: boolean; fileCount: number };

function membersCollection() {
  const auth = getClientAuth();
  if (!auth.currentUser) throw new Error("로그인이 필요해요.");
  return collection(getFirestore(auth.app), "trainers", auth.currentUser.uid, "members");
}
export function cleanMember(input: MemberInput): MemberInput {
  const result = {name: input.name.trim(), goal: input.goal.trim(), notes: input.notes.trim()};
  if (!result.name || result.name.length > 60) throw new Error("회원 이름은 1~60자로 입력해주세요.");
  if (result.goal.length > 300 || result.notes.length > 1000) throw new Error("목표는 300자, 메모는 1,000자까지 입력할 수 있어요.");
  return result;
}
export function listenMembers(onData: (members: Member[], fromCache: boolean) => void, onError: (error: unknown) => void) {
  return onSnapshot(query(membersCollection(), orderBy("createdAt", "desc")), {includeMetadataChanges: true}, snapshot => {
    onData(snapshot.docs.map(d => ({id: d.id, name: d.data().name, goal: d.data().goal, notes: d.data().notes, createdAt: d.data().createdAt ?? null, fileCount: d.data().fileCount ?? 0, pending: d.metadata.hasPendingWrites})), snapshot.metadata.fromCache);
  }, onError);
}
export async function createMember(input: MemberInput) {
  const ref = doc(membersCollection());
  await setDoc(ref, {...cleanMember(input), fileCount:0, lastFileId:"", createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
  return ref.id;
}
export async function editMember(id: string, input: MemberInput) {
  await updateDoc(doc(membersCollection(), id), {...cleanMember(input), updatedAt: serverTimestamp()});
}
export async function removeMember(id: string) {
  await deleteDoc(doc(membersCollection(), id));
}
export function memberError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "permission-denied") return "회원 정보에 접근할 수 없어요. 로그인 계정과 서비스 연결을 확인해주세요.";
  if (code === "unavailable") return "서버에 연결하지 못했어요. 인터넷 연결 후 다시 시도해주세요.";
  if (code === "resource-exhausted") return "현재 서비스 요청 한도에 도달했어요. 잠시 후 다시 시도해주세요.";
  if (code === "not-found") return "다른 화면에서 삭제된 회원이에요. 목록을 다시 확인해주세요.";
  return "회원 정보를 처리하지 못했어요. 다시 시도해주세요.";
}
