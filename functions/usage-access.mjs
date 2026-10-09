import {HttpsError} from 'firebase-functions/v2/https';

// This allowlist is server-managed; no client can grant or edit billing access.
export function createUsageAccess({db,reporting}){
 async function allowed(auth){
  if(!auth?.uid||auth.token?.email_verified!==true)return false;
  const config=await db.doc('systemAccess/billing').get();
  return Array.isArray(config.data()?.uids)&&config.data().uids.includes(auth.uid);
 }
 return async function handle(auth,data){
  if(!auth?.uid)throw new HttpsError('unauthenticated','로그인이 필요해요.');
  const admin=await allowed(auth);
  if(data.action==='access')return {admin};
  if(!admin)throw new HttpsError('permission-denied','관리자만 비용을 조회할 수 있어요.');
  if(data.action==='report')return reporting.report(auth.uid,data,{project:true});
  if(data.action==='setPurpose')return reporting.setPurpose(auth.uid,data);
  throw new HttpsError('invalid-argument','지원하지 않는 요청이에요.');
 };
}
