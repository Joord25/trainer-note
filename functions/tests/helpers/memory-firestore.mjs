// Minimal in-memory stand-in for the Firestore Admin API surface the coaching workflow uses.
// Transactions buffer writes and apply them at the end; there is no contention handling.
import {Timestamp} from 'firebase-admin/firestore';

const isTimestamp=v=>v&&typeof v==='object'&&typeof v.toMillis==='function';
const sentinel=v=>v&&typeof v==='object'&&typeof v.methodName==='string'?v.methodName:'';
function clone(v){
 if(Array.isArray(v))return v.map(clone);
 if(isTimestamp(v)||v===null||typeof v!=='object')return v;
 return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,clone(x)]));
}
const at=(obj,path)=>path.split('.').reduce((o,k)=>o?.[k],obj);

export function createMemoryFirestore({now=()=>Date.now()}={}){
 const store=new Map();let tick=0;
 // serverTimestamp resolves to a strictly increasing time so orderBy('updatedAt') is deterministic.
 const resolve=(value,base)=>{
  const out=base?clone(base):{};
  for(const [k,v] of Object.entries(value)){
   const m=sentinel(v);
   if(m==='FieldValue.delete')delete out[k];
   else if(m==='FieldValue.serverTimestamp')out[k]=Timestamp.fromMillis(now()+(++tick));
   else if(v&&typeof v==='object'&&!Array.isArray(v)&&!isTimestamp(v)&&!m)out[k]=resolve(v,undefined);
   else out[k]=clone(v);
  }
  return out;
 };
 const snapshot=ref=>{const v=store.get(ref.path);return {id:ref.id,ref,exists:v!==undefined,data:()=>v===undefined?undefined:clone(v)};};
 function docRef(path){
  const id=path.split('/').at(-1);
  const ref={path,id,
   get:async()=>snapshot(ref),
   set:async(v,opt)=>{store.set(path,resolve(v,opt?.merge?store.get(path):undefined));},
   update:async v=>{if(!store.has(path))throw Error('not-found '+path);store.set(path,resolve(v,store.get(path)));},
   delete:async()=>{store.delete(path);},
   collection:name=>collectionRef(`${path}/${name}`)};
  return ref;
 }
 function query(path,ops=[]){
  const q={path,
   orderBy:(field,dir='asc')=>query(path,[...ops,{kind:'order',field,dir}]),
   limit:n=>query(path,[...ops,{kind:'limit',n}]),
   where:(field,op,value)=>{if(op!=='==')throw Error('only == supported');return query(path,[...ops,{kind:'where',field,value}]);},
   get:async()=>{
    const depth=path.split('/').length+1;
    let docs=[...store.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===depth).sort().map(k=>snapshot(docRef(k)));
    for(const o of ops){
     if(o.kind==='where')docs=docs.filter(d=>at(d.data(),o.field)===o.value);
     if(o.kind==='order'){const key=d=>{const v=at(d.data(),o.field);return isTimestamp(v)?v.toMillis():v??0;};docs.sort((a,b)=>(key(a)-key(b))*(o.dir==='desc'?-1:1));}
     if(o.kind==='limit')docs=docs.slice(0,o.n);
    }
    return {docs,size:docs.length,empty:!docs.length};
   }};
  return q;
 }
 function collectionRef(path){return {...query(path),doc:id=>docRef(`${path}/${id??Math.random().toString(16).slice(2)}`)};}
 const db={
  doc:docRef,collection:collectionRef,
  async runTransaction(fn){
   const writes=[];
   const tx={
    get:async r=>typeof r.collection==='function'&&'id' in r?r.get():r.get(),
    getAll:async(...refs)=>Promise.all(refs.map(r=>r.get())),
    set:(r,v,opt)=>{writes.push(()=>r.set(v,opt));},
    create:(r,v)=>{writes.push(()=>{if(store.has(r.path))throw Error('already-exists '+r.path);return r.set(v);});},
    update:(r,v)=>{writes.push(()=>r.update(v));},
    delete:r=>{writes.push(()=>r.delete());},
   };
   const result=await fn(tx);
   for(const w of writes)await w();
   return result;
  },
  dump:prefix=>[...store.keys()].filter(k=>k.startsWith(prefix)),
 };
 return db;
}
