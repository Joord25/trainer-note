"use client";
import {useEffect,useRef,useState} from 'react';

export type BulkFailure={id:string;message:string};
export type BulkOperation<T>={id:string;label:string;description:string;remove:(items:T[])=>Promise<BulkFailure[]>};
export function useBulkSelection<T extends {id:string}>({items:inputItems,noun,online,operations,before,onBusy}:{items:T[];noun:string;online:boolean;operations:BulkOperation<T>[];before:()=>boolean;onBusy?:(busy:boolean)=>void}){
 const [selected,setSelected]=useState(new Set<string>()),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[pending,setPending]=useState<{items:T[];operation:BulkOperation<T>}|null>(null);
 const [removed,setRemoved]=useState(new Set<string>());
 useEffect(()=>{const ids=new Set(inputItems.map(v=>v.id));setRemoved(old=>{const next=new Set([...old].filter(id=>ids.has(id)));return next.size===old.size?old:next;});},[inputItems]);
 const items=inputItems.filter(v=>!removed.has(v.id));
 const lock=useRef(false),ids=new Set(items.map(v=>v.id)),chosen=items.filter(v=>selected.has(v.id));
 const all=items.length>0&&chosen.length===items.length;
 useEffect(()=>{if(!busy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[busy]);
 function toggle(id:string){if(busy)return;setSelected(old=>{const next=new Set([...old].filter(id=>ids.has(id)));if(next.has(id))next.delete(id);else next.add(id);return next;});}
 function ask(targets:T[],operation:BulkOperation<T>){if(!online||busy||!targets.length||!before())return;setPending({items:[...targets],operation});setNotice('');}
 async function run(request=pending){if(!request||lock.current||!online||!before())return;lock.current=true;setBusy(true);onBusy?.(true);try{
  const failed=await request.operation.remove(request.items),failedIds=new Set(failed.map(v=>v.id));
  setRemoved(old=>new Set([...old,...request.items.filter(v=>!failedIds.has(v.id)).map(v=>v.id)]));
  setSelected(new Set(failedIds));setNotice(`${request.items.length-failed.length}개 삭제 완료${failed.length?` · ${failed.length}개 실패. ${[...new Set(failed.map(v=>v.message))].join(' ')} 실패한 항목은 선택 상태로 남겨두었어요.`:''}`);
 }catch(e){setSelected(new Set(request.items.map(v=>v.id)));setNotice(e instanceof Error?e.message:'삭제 상태를 확인한 뒤 다시 시도해주세요.');}finally{setPending(null);lock.current=false;setBusy(false);onBusy?.(false);}}
 const checkbox=(item:T,label:string)=><label className="bulk-item-check" onClick={e=>e.stopPropagation()}><input type="checkbox" aria-label={`${label} 선택`} checked={selected.has(item.id)} disabled={busy||!online} onChange={()=>toggle(item.id)}/><span className="sr-only">{label} 선택</span></label>;
 const toolbar=<><div className="bulk-selection-bar" aria-label={`${noun} 선택 및 삭제`} aria-busy={busy}>
 <label><input type="checkbox" aria-label={`${noun} 전체 선택`} checked={all} ref={el=>{if(el)el.indeterminate=chosen.length>0&&!all;}} disabled={busy||!online||!items.length} onChange={()=>setSelected(all?new Set():new Set(items.map(v=>v.id)))}/>전체 선택</label><span>{chosen.length} / {items.length}개 선택</span>
 {operations.map(op=><button key={op.id} disabled={!online||busy||!chosen.length} onClick={()=>ask(chosen,op)}>{op.label}</button>)}
 <button disabled={!online||busy||!items.length} onClick={()=>ask(items,operations.at(-1)!)}>전체 {noun} 삭제</button>
 {chosen.length>0&&<button disabled={busy} onClick={()=>setSelected(new Set())}>선택 해제</button>}
 {busy&&<span role="status">삭제 중… 화면을 유지해주세요.</span>}</div>
 {notice&&<p className="bulk-selection-notice" role="status">{notice}</p>}
 {pending&&<BulkConfirm noun={noun} count={pending.items.length} operation={pending.operation} busy={busy} online={online} onClose={()=>setPending(null)} onConfirm={()=>void run()}/>}</>;
 const selectControl=<label className="bulk-compact-select" title={chosen.length?chosen.length+'개 선택됨':'전체 선택'}><input type="checkbox" aria-label={noun+' 전체 선택'} checked={all} ref={el=>{if(el)el.indeterminate=chosen.length>0&&!all;}} disabled={busy||!online||!items.length} onChange={()=>setSelected(all?new Set():new Set(items.map(v=>v.id)))}/>{chosen.length>0&&<span>{chosen.length}</span>}</label>;
 const menuActions=(fallback?:T)=><div className="bulk-menu-actions"><small>{chosen.length?chosen.length+'개 선택됨':fallback?'현재 '+noun:'선택한 항목 없음'}</small>{operations.map(op=><button key={op.id} disabled={!online||busy||(!chosen.length&&!fallback)} onClick={e=>{e.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();ask(chosen.length?chosen:fallback?[fallback]:[],op);}}>{op.label}</button>)}<button disabled={!online||busy||!items.length} onClick={e=>{e.currentTarget.closest<HTMLElement>('[popover]')?.hidePopover();ask(items,operations.at(-1)!);}}>전체 {noun} 삭제</button>{chosen.length>0&&<button disabled={busy} onClick={()=>setSelected(new Set())}>선택 해제</button>}</div>;
 const feedback=<>{busy&&<p className="bulk-selection-notice" role="status">삭제 중… 화면을 유지해주세요.</p>}{notice&&<p className="bulk-selection-notice" role="status">{notice}</p>}{pending&&<BulkConfirm noun={noun} count={pending.items.length} operation={pending.operation} busy={busy} online={online} onClose={()=>setPending(null)} onConfirm={()=>void run()}/>}</>;
 return {checkbox,toolbar,busy,selectControl,menuActions,feedback,items,selectedCount:chosen.length,deleteSelectedImmediately:()=>{if(chosen.length)void run({items:[...chosen],operation:operations[0]});}};
}
function BulkConfirm({noun,count,operation,busy,online,onClose,onConfirm}:{noun:string;count:number;operation:{label:string;description:string};busy:boolean;online:boolean;onClose:()=>void;onConfirm:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>previous?.focus();},[]);
 return <dialog ref={dialog} className="bulk-delete-dialog" onCancel={e=>{e.preventDefault();if(!busy)onClose();}} aria-labelledby="bulk-delete-title"><h2 id="bulk-delete-title">{noun} {count}개를 삭제할까요?</h2><p>{operation.description}</p><p>선택한 {count}개에 적용됩니다. 삭제 후에는 되돌릴 수 없어요.</p><div><button autoFocus disabled={busy} onClick={onClose}>취소</button><button className="member-danger" disabled={busy||!online} onClick={onConfirm}>{busy?'삭제 중…':`${count}개 · ${operation.label}`}</button></div></dialog>;
}
