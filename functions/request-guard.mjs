import {randomUUID} from 'node:crypto';
import {HttpsError} from 'firebase-functions/v2/https';

// Short-lived burst protection, independent of daily/monthly AI usage policy.
export function createRequestGuard({db,now=()=>Date.now(),burst=20,perMinute=60,maxConcurrent=4,leaseMs=190000}){
 async function acquire(uid){
  const ref=db.doc(`trainers/${uid}/requestGuards/trainerAi`),id=randomUUID();
  await db.runTransaction(async tx=>{
   const [current,deletion]=await tx.getAll(ref,db.doc(`accountDeletions/${uid}`));
   if(deletion.exists)throw new HttpsError('permission-denied','회원탈퇴 처리 중이에요.');
   const time=now(),state=current.data()??{},active=Object.fromEntries(Object.entries(state.active??{}).filter(([,until])=>until>time));
   const tokens=Math.min(burst,(state.tokens??burst)+Math.max(0,time-(state.updatedMs??time))*perMinute/60000);
   if(Object.keys(active).length>=maxConcurrent||tokens<1)throw new HttpsError('resource-exhausted','진행 중인 요청이 많아요. 잠시 후 다시 시도해주세요.',{retryAfterSeconds:Math.max(1,Math.ceil((1-tokens)*60/perMinute))});
   active[id]=time+leaseMs;
   tx.set(ref,{tokens:tokens-1,updatedMs:time,active});
  });
  return async()=>{await db.runTransaction(async tx=>{
   const current=await tx.get(ref);if(!current.exists)return;
   const state=current.data();if(!Object.hasOwn(state.active??{},id))return;
   const active={...state.active};delete active[id];tx.update(ref,{active});
  });};
 }
 return {acquire};
}
