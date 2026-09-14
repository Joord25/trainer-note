"use client";

import {useEffect,useRef} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from './icons';

export function CapturePreview({image,title,onClose}:{image:string;title:string;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),backdropStart=useRef(false);
 useEffect(()=>{
  const previous=document.activeElement as HTMLElement|null,element=dialog.current;
  element?.showModal();
  return()=>{element?.close();if(previous?.isConnected)previous.focus();};
 },[]);
 return createPortal(<dialog ref={dialog} className="capture-preview-dialog" aria-label="캡처 크게 보기" onCancel={e=>{e.preventDefault();onClose();}} onPointerDown={e=>{backdropStart.current=e.target===e.currentTarget;}} onClick={e=>{if(e.target===e.currentTarget&&backdropStart.current)onClose();}}>
  <header className="capture-preview-heading"><span>{title}</span><button type="button" aria-label="캡처 미리보기 닫기" autoFocus onClick={onClose}><Icon name="close" size={24}/></button></header>
  <img className="capture-preview-image" src={image} alt={`${title} 확대 미리보기`} draggable={false}/>
 </dialog>,document.body);
}
