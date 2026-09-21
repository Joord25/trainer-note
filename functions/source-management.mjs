import {FieldValue} from 'firebase-admin/firestore';

// Keep manifests for archived sources: saved records remain editable and retain provenance.
export function createSourceManagement({db,bucket}) {
 const stamp=()=>FieldValue.serverTimestamp();
 return async function manageSource(uid,mid,request) {
  if(![uid,mid].every(v=>typeof v==='string'&&/^[-_a-zA-Z0-9]{1,128}$/.test(v))||!/^([a-f0-9]{64})$/.test(request.fileId??''))throw Error('원본 정보를 확인해주세요.');
  const operation=request.operation;
  if(!['rename','archive','delete','clearRecords'].includes(operation))throw Error('원본 작업을 확인해주세요.');
  const m=db.doc(`trainers/${uid}/members/${mid}`),f=m.collection('files').doc(request.fileId),imp=m.collection('imports').doc(request.fileId);
  if(operation==='rename') {
   const name=typeof request.name==='string'?request.name.trim():'';
   if(!name||name.length>200)throw Error('파일명은 1~200자로 입력해주세요.');
   await db.runTransaction(async tx=>{const [p,s]=await tx.getAll(m,f);if(!p.exists||!s.exists||s.data().status!=='ready')throw Error('최신 원본 상태에서 다시 시도해주세요.');tx.update(f,{displayName:name,updatedAt:stamp()});});
   return {ok:true};
  }
  let source;
  await db.runTransaction(async tx=>{
   const [p,s,i]=await tx.getAll(m,f,imp);
   if(!p.exists||(!s.exists&&operation!=='clearRecords'))throw Error('원본이 이미 삭제됐어요. 목록을 새로 확인해주세요.');
   source=s.data()||{};
   if(operation==='clearRecords'&&source.deletionOperation!=='clearRecords'&&(!i.exists||i.data().revision!==request.revision))throw Error('판독 내용이 변경됐어요. 다시 확인해주세요.');
   if(source.status==='deleting'&&source.deletionOperation!==operation)throw Error('진행 중인 삭제를 먼저 완료해주세요.');
   if(source.status==='uploading')throw Error('업로드 완료 후 삭제해주세요.');
   if(i.data()?.status==='processing')throw Error('판독이 끝난 뒤 삭제해주세요.');
   if(s.exists)tx.update(f,{status:'deleting',deletionOperation:operation,updatedAt:stamp()});
   if(operation==='clearRecords')tx.update(imp,{status:'deleting'});
  });
  const objectName={'application/pdf':'source.pdf','image/png':'source.png','image/jpeg':'source.jpg'}[source.contentType];
  if(operation!=='clearRecords'&&!objectName)throw Error('원본 형식을 확인해주세요.');
  // Delete bytes first. On failure retain the manifest and retry the same operation.
  if(operation!=='clearRecords')await bucket.file(`${m.path}/files/${request.fileId}/${objectName}`).delete({ignoreNotFound:true});
  if(operation==='archive') {
   await db.runTransaction(async tx=>{const s=await tx.get(f);if(s.data()?.deletionOperation!=='archive')throw Error('원본 상태가 변경됐어요.');tx.update(f,{status:'ready',originalRemoved:true,deletionOperation:FieldValue.delete(),updatedAt:stamp()});});
   return {ok:true};
  }
  // Bounded transactions also support files with more than 500 saved exercises.
  for(;;) {
   const remaining=await db.runTransaction(async tx=>{
    const [p,s,i]=await tx.getAll(m,f,imp);
    if(!p.exists||(!s.exists&&operation!=='clearRecords'))return false;
    if(operation==='clearRecords'?i.data()?.status!=='deleting':s.data()?.deletionOperation!=='delete')throw Error('원본 상태가 변경됐어요.');
    const records=await tx.get(m.collection('records').where('sourceHash','==',request.fileId).limit(200));
    if(!records.empty){records.docs.forEach(d=>tx.delete(d.ref));tx.update(m,{recordCount:Math.max(0,(p.data().recordCount??0)-records.size),lastRecordId:records.docs.at(-1).id,updatedAt:stamp()});
     if(i.exists)tx.update(imp,{rows:(i.data().rows??[]).map(r=>({...r,review:'ignored'})),revision:(i.data().revision??0)+1});
     return true;}
    if(operation==='clearRecords'){
     if(!s.exists||s.data().originalRemoved){tx.delete(imp);if(s.exists){tx.delete(f);tx.update(m,{fileCount:Math.max(0,(p.data().fileCount??0)-1),lastFileId:request.fileId,updatedAt:stamp()});}return false;}
     if(i.exists)tx.update(imp,{status:'ready',rows:(i.data().rows??[]).map(r=>({...r,review:'ignored'})),unparsed:[],recordsDeleted:true,revision:(i.data().revision??0)+1,updatedAt:stamp()});
     if(s.exists)tx.update(f,{status:'ready',deletionOperation:FieldValue.delete(),updatedAt:stamp()});return false;
    }
    tx.delete(imp);tx.delete(f);tx.update(m,{fileCount:Math.max(0,(p.data().fileCount??0)-1),lastFileId:request.fileId,updatedAt:stamp()});return false;
   });
   if(!remaining)break;
  }
  return {ok:true};
 };
}
