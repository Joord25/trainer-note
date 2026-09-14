import {Timestamp} from 'firebase-admin/firestore';
import {createHash} from 'node:crypto';
export function createAccountService({db,auth,bucket,enqueue,now=()=>Date.now()}){
 const lock=uid=>db.doc(`accountDeletions/${uid}`);
 const validUid=uid=>{if(typeof uid!=='string'||!/^[-_a-zA-Z0-9]{1,128}$/.test(uid))throw Error('계정을 확인해주세요.');};
 async function active(uid){validUid(uid);if((await lock(uid).get()).exists)throw Error('회원탈퇴 처리 중인 계정이에요.');const u=await auth.getUser(uid);if(u.disabled)throw Error('사용할 수 없는 계정이에요.');}
 async function removeAuth(uid){try{await auth.deleteUser(uid);}catch(e){if(e.code!=='auth/user-not-found')throw e;}}
 async function deleteAccount(uid,{confirmed,authTime}){
  validUid(uid);if(confirmed!==true||!Number.isFinite(authTime)||now()/1000-authTime>300||authTime>now()/1000+30)throw Error('Google 계정을 다시 확인한 뒤 탈퇴해주세요.');
  const ref=lock(uid);await db.runTransaction(async tx=>{const d=await tx.get(ref);if(!d.exists)tx.create(ref,{requestedAt:Timestamp.fromMillis(now()),status:'pending'});});
  // Delay beyond every existing 180s AI invocation before sweeping. The lock
  // blocks clients and all new triggers/tasks, including still-valid ID tokens.
  await enqueue({uid,phase:'purge'},210,'purge-'+createHash('sha256').update(uid).digest('hex'));
  await removeAuth(uid);
  return {status:'deleting',message:'탈퇴가 접수됐어요. 계정 접근은 해제됐으며 기록과 원본 파일은 몇 분 내 삭제돼요.'};
 }
 async function finishDeletion({uid,phase}){
  validUid(uid);if(!['purge','release'].includes(phase))throw Error('Invalid deletion phase');
  const ref=lock(uid),state=(await ref.get()).data();if(!state)return;
  if(phase==='release'){
   if(state.status!=='purged')throw Error('Account purge not complete');
   if(now()-state.requestedAt.toMillis()<3900000)throw Error('Token expiry window not complete');
   await ref.delete();return;
  }
  if(now()-state.requestedAt.toMillis()<210000)throw Error('Active invocation window not complete');
  await removeAuth(uid);
  await bucket.deleteFiles({prefix:`trainers/${uid}/`,force:true});
  await db.recursiveDelete(db.doc(`trainers/${uid}`));
  await ref.update({status:'purged'});
  // Temporary UID-only revocation lock, removed after the final old ID token expires.
  await enqueue({uid,phase:'release'},Math.max(1,Math.ceil((state.requestedAt.toMillis()+3900000-now())/1000)),'release-'+createHash('sha256').update(uid).digest('hex'));
 }
 async function feedback(uid,data){
  await active(uid);
  const {requestId,topic,message,contact=''}=data;
  if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId)||!['회원 홈','기록 수정','진행 분석','다음 수업','AI 도우미','업로드','설정','기타'].includes(topic)||typeof message!=='string'||!message.trim()||message.length>2000||typeof contact!=='string'||contact.length>150)throw Error('문의 내용을 확인해주세요.');
  const parent=db.doc(`trainers/${uid}`),ref=parent.collection('feedback').doc(requestId),rate=parent.collection('feedbackState').doc('current');
  await db.runTransaction(async tx=>{const [old,recent,deleting]=await tx.getAll(ref,rate,lock(uid));if(deleting.exists)throw Error('탈퇴 처리 중이에요.');if(old.exists){if(old.data().message!==message.trim())throw Error('새 문의로 다시 보내주세요.');return;}if(recent.exists&&now()-recent.data().sentAt.toMillis()<30000)throw Error('잠시 후 다시 보내주세요.');tx.create(ref,{topic,message:message.trim(),contact:contact.trim(),status:'received',createdAt:Timestamp.fromMillis(now())});tx.set(rate,{sentAt:Timestamp.fromMillis(now())});});
  return {status:'received',receiptId:requestId};
 }
 return {active,deleteAccount,finishDeletion,feedback};
}
