// Read only bounded metadata; this endpoint never runs an AI model.
export async function memberOverviews(db,uid,ids){
 if(!Array.isArray(ids)||!ids.length||ids.length>50||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!/^[-_a-zA-Z0-9]{1,100}$/.test(id)))throw Error('회원 목록을 확인해주세요.');
 const result={};
 // Limit concurrency so large directories do not fan out hundreds of reads at once.
 for(let offset=0;offset<ids.length;offset+=5)await Promise.all(ids.slice(offset,offset+5).map(async id=>{
  const member=db.doc(`trainers/${uid}/members/${id}`),parent=await member.get();
  if(!parent.exists){result[id]={error:true};return;}
  try{
   const [goal,record,analysis,plan]=await Promise.all([
    member.collection('trainingGoals').doc('current').get(),
    member.collection('records').orderBy('performedAt','desc').limit(1).select('performedAt').get(),
    member.collection('changeReviews').orderBy('updatedAt','desc').limit(1).select('status','updatedAt').get(),
    member.collection('cyclePlans').doc('current').get(),
   ]);
   const g=goal.data(),a=analysis.docs[0]?.data(),date=record.docs[0]?.data().performedAt?.toDate();
   const primary=g?(g.primary==='직접 설정'?g.detail?.trim()||'직접 설정':g.primary):parent.data().goal;
   result[id]={goal:primary||'',secondary:g?.secondary??[],lastRecordDate:date?date.toISOString().slice(0,10):'',hasAnalysis:a?.status==='ready',hasPlan:!!plan.data()?.plan?.sessions?.length,analysisDate:a?.updatedAt?.toDate().toISOString().slice(0,10)??''};
  }catch{result[id]={error:true};}
 }));
 return result;
}
