import {FieldValue} from 'firebase-admin/firestore';

// Each request has an explicit, versioned target list. Never query-and-delete new records.
export function createRecordDeletion({db,scheduleReport}) {
 return async (uid,mid,{targets})=>{
  if(![uid,mid].every(v=>typeof v==='string'&&/^[-_a-zA-Z0-9]{1,128}$/.test(v))||!Array.isArray(targets)||!targets.length||targets.length>5000||new Set(targets.map(v=>v?.id)).size!==targets.length||targets.some(v=>!v||!/^[a-zA-Z0-9]{20}$/.test(v.id)||!Number.isInteger(v.recordRevision)||v.recordRevision<0||(v.fileId&&!/^[a-f0-9]{64}$/.test(v.fileId))||(v.fileId&&(!Number.isInteger(v.rowRevision)||v.rowRevision<0))))throw Error('삭제할 기록을 다시 선택해주세요.');
  const m=db.doc(`trainers/${uid}/members/${mid}`),deletedIds=[],failed=[];
  for(let offset=0;offset<targets.length;offset+=50){
   const batch=targets.slice(offset,offset+50);
   try {await db.runTransaction(async tx=>{
    const [parent,...records]=await tx.getAll(m,...batch.map(v=>m.collection('records').doc(v.id)));
    if(!parent.exists)throw Error('회원이 없어요.');
    const sourceIds=[...new Set(batch.flatMap((v,i)=>[v.fileId,records[i].data()?.sourceHash]).filter(Boolean))];
    const snapshots=sourceIds.length?await tx.getAll(...sourceIds.flatMap(id=>[m.collection('files').doc(id),m.collection('imports').doc(id)])):[];
    const sources=new Map(sourceIds.map((id,i)=>[id,{file:snapshots[i*2],imp:snapshots[i*2+1]}])),changes=new Map();let count=0;
    for(const [i,target] of batch.entries()){
     const record=records[i],hash=target.fileId||record.data()?.sourceHash,source=sources.get(hash),data=source?.imp.data();
     if(source?.file.data()?.status==='deleting'||source?.file.data()?.status==='uploading'||data?.status==='processing')throw Error('판독 또는 원본 처리가 끝난 뒤 다시 시도해주세요.');
     if(target.fileId&&record.exists&&record.data().sourceHash!==target.fileId)throw Error('원본 연결이 변경됐어요. 다시 선택해주세요.');
     const row=data?.rows?.find(r=>r.id===target.id);
     if(!record.exists&&(!row||row.review==='ignored'))continue;
     if((record.data()?.revision??0)!==target.recordRevision||(target.fileId&&(!row||row.revision!==target.rowRevision)))throw Error('선택한 기록이 변경됐어요. 최신 내용을 확인하고 다시 선택해주세요.');
     if(record.exists){tx.delete(record.ref);count++;}
     if(row){const rows=changes.get(hash)||data.rows;changes.set(hash,rows.map(r=>r.id===target.id?{...r,review:'ignored',issues:[],revision:(r.revision??0)+1}:r));}
    }
    for(const [hash,rows] of changes){const imp=sources.get(hash).imp;tx.update(imp.ref,{rows,revision:(imp.data().revision??0)+1,updatedAt:FieldValue.serverTimestamp()});}
    if(count)tx.update(m,{recordCount:Math.max(0,(parent.data().recordCount??0)-count),lastRecordId:batch.at(-1).id,updatedAt:FieldValue.serverTimestamp()});
   });deletedIds.push(...batch.map(v=>v.id));}
   catch(e){failed.push(...batch.map(v=>({id:v.id,message:/^[가-힣]/.test(e.message)?e.message:'삭제하지 못했어요. 다시 시도해주세요.'})));}
  }
  if(deletedIds.length)await scheduleReport(uid,mid).catch(()=>{});
  return {deletedIds,failed};
 };
}
