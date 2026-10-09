// Remove obsolete model metadata from client-readable chat documents.
// Uses Application Default Credentials. Dry run unless --apply is passed.
// Never reads or prints questions, answers, member identities, or credentials.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../functions/package.json',import.meta.url));
const {initializeApp,applicationDefault,deleteApp}=require('firebase-admin/app');
const {getFirestore,FieldPath,FieldValue}=require('firebase-admin/firestore');
const projectId=process.argv.find(v=>v.startsWith('--project='))?.slice(10);
if(!projectId||!/^[a-z][a-z0-9-]+$/.test(projectId))throw Error('Use --project=<Firebase project ID> [--apply].');
const app=initializeApp({projectId,...(!process.env.FIRESTORE_EMULATOR_HOST?{credential:applicationDefault()}:{})});
const db=getFirestore(app),apply=process.argv.includes('--apply');let cursor=null,scanned=0,changed=0;
try{
 while(true){
  let query=db.collectionGroup('chats').select('model').orderBy(FieldPath.documentId()).limit(300);
  if(cursor)query=query.startAfter(cursor);
  const page=await query.get();if(page.empty)break;
  const batch=db.batch();let updates=0;
  for(const doc of page.docs){
   scanned++;
   if(!/^trainers\/[^/]+\/members\/[^/]+\/chats\/[^/]+$/.test(doc.ref.path)||!Object.hasOwn(doc.data(),'model'))continue;
   updates++;if(apply)batch.update(doc.ref,{model:FieldValue.delete()},{lastUpdateTime:doc.updateTime});
  }
  if(apply&&updates)await batch.commit();changed+=updates;cursor=page.docs.at(-1);
 }
 console.log(JSON.stringify({mode:apply?'applied':'dry-run',scanned,documentsWithModel:changed}));
}catch{console.error('Cleanup did not complete. Check administrator Application Default Credentials and rerun; already cleaned documents are safe to skip.');process.exitCode=1;}
finally{await deleteApp(app);}
