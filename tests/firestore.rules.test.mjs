import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, deleteDoc, deleteField, Timestamp } from "firebase/firestore";

let env;
const path = "trainers/trainer-a/members/member-1";
const valid = () => ({name: "테스트 회원", goal: "주 2회 운동", notes: "테스트", createdAt: serverTimestamp(), updatedAt: serverTimestamp()});
const db = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();
before(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error("Run through Firebase emulators:exec; never against production.");
  env = await initializeTestEnvironment({projectId: "demo-trainer-note", firestore: {rules: readFileSync("firestore.rules", "utf8")}});
});
beforeEach(async () => {await env.clearFirestore();});
after(async () => {await env?.cleanup();});

test("owner can create, read, list in UI order, update and delete", async () => {
  const own = db("trainer-a"), ref = doc(own, path);
  await assertSucceeds(setDoc(ref, valid()));
  assert.equal((await getDoc(ref)).data().name, "테스트 회원");
  const list = await assertSucceeds(getDocs(query(collection(own, "trainers/trainer-a/members"), orderBy("createdAt", "desc"))));
  assert.equal(list.size, 1);
  await assertSucceeds(updateDoc(ref, {goal: "변경한 목표", updatedAt: serverTimestamp()}));
  assert.equal((await getDoc(ref)).data().goal, "변경한 목표");
  await assertSucceeds(deleteDoc(ref));
  assert.equal((await getDoc(ref)).exists(), false);
});
test("second session reads persisted member and realtime listener receives updates", async () => {
  const ref = doc(db("trainer-a"), path);
  await setDoc(ref, valid());
  const otherSession = db("trainer-a");
  assert.equal((await getDoc(doc(otherSession, path))).data().name, "테스트 회원");
  const event = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {stop(); reject(new Error("Realtime update timeout"));}, 10000);
    const stop = onSnapshot(doc(otherSession, path), s => {if (s.data()?.notes === "다른 창에서 수정") {clearTimeout(timer); stop(); resolve();}}, reject);
  });
  await updateDoc(ref, {notes: "다른 창에서 수정", updatedAt: serverTimestamp()});
  await event;
});
for (const uid of [null, "trainer-b"]) {
  test(`${uid ?? "anonymous"} cannot read/list/create/update/delete trainer-a members`, async () => {
    await setDoc(doc(db("trainer-a"), path), valid());
    const other = db(uid);
    await assertFails(getDoc(doc(other, path)));
    await assertFails(getDocs(collection(other, "trainers/trainer-a/members")));
    await assertFails(setDoc(doc(other, "trainers/trainer-a/members/forged"), valid()));
    await assertFails(updateDoc(doc(other, path), {name: "침입", updatedAt: serverTimestamp()}));
    await assertFails(deleteDoc(doc(other, path)));
  });
}
const invalid = [
 ["empty name", {name: ""}], ["blank name", {name: "   "}], ["wrong name type", {name: 1}],
 ["long name", {name: "가".repeat(61)}], ["long goal", {goal: "가".repeat(301)}],
 ["long notes", {notes: "가".repeat(1001)}], ["wrong notes type", {notes: []}],
 ["owner spoofing", {ownerId: "trainer-b"}], ["admin injection", {role: "admin"}],
 ["unknown field", {extraData: "unexpected"}], ["wrong timestamp", {updatedAt: "tomorrow"}],
 ["past timestamp", {updatedAt: Timestamp.fromMillis(0)}],
];
for (const [label, patch] of invalid) {
 test(`create and update both reject ${label}`, async () => {
   const ref = doc(db("trainer-a"), path);
   await assertFails(setDoc(ref, {...valid(), ...patch}));
   await setDoc(ref, valid());
   await assertFails(updateDoc(ref, {updatedAt: serverTimestamp(), ...patch}));
 });
}
test("required fields cannot be omitted or removed", async () => {
 const ref = doc(db("trainer-a"), path);
 for (const key of ["name", "goal", "notes", "createdAt", "updatedAt"]) {
  const data = valid(); delete data[key];
  await assertFails(setDoc(ref, data));
 }
 await setDoc(ref, valid());
 for (const key of ["name", "goal", "notes", "createdAt", "updatedAt"]) {
  await assertFails(updateDoc(ref, {updatedAt: serverTimestamp(), [key]: deleteField()}));
 }
});
test("creation time cannot be forged or changed", async () => {
 const ref = doc(db("trainer-a"), path);
 await assertFails(setDoc(ref, {...valid(), createdAt: Timestamp.fromMillis(0)}));
 await setDoc(ref, valid());
 await assertFails(updateDoc(ref, {createdAt: Timestamp.fromMillis(0), updatedAt: serverTimestamp()}));
});
test("unknown collections, trainer profiles and nested records remain denied", async () => {
 const own = db("trainer-a");
 for (const p of ["trainers/trainer-a", "public/test", path + "/records/record-1"]) {
  await assertFails(setDoc(doc(own, p), valid()));
  await assertFails(getDoc(doc(own, p)));
 }
});
test("same names retain separate document identities", async () => {
 const own = db("trainer-a");
 await setDoc(doc(own, path), valid());
 await setDoc(doc(own, "trainers/trainer-a/members/member-2"), valid());
 assert.equal((await getDocs(collection(own, "trainers/trainer-a/members"))).size, 2);
});
