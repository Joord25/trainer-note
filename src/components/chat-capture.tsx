"use client";
import {useEffect,useRef,useState} from 'react';
import {readChatCapture} from '../lib/server-ai';
import {Icon} from './icons';
export function ChatCapture({memberId,messageId,localImage,onPreview}:{memberId:string;messageId:string;localImage?:string;onPreview:(image:string)=>void}){
 const ref=useRef<HTMLButtonElement>(null),[image,setImage]=useState(localImage||''),[visible,setVisible]=useState(false),[failed,setFailed]=useState(false),[attempt,setAttempt]=useState(0);
 useEffect(()=>{if(!ref.current)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){setVisible(true);observer.disconnect();}},{rootMargin:'100px'});observer.observe(ref.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(localImage){setImage(localImage);return;}if(!visible)return;let live=true;setFailed(false);void readChatCapture(memberId,messageId).then(value=>{if(live){setImage(value||'');setFailed(!value);}}).catch(()=>{if(live)setFailed(true);});return()=>{live=false;};},[memberId,messageId,localImage,visible,attempt]);
 return <button ref={ref} type="button" className="chat-capture-image" aria-label={failed?'캡처 다시 불러오기':'보낸 캡처 크게 보기'} onClick={()=>{if(image)onPreview(image);else if(failed)setAttempt(v=>v+1);}}>{image?<img src={image} alt="질문에 첨부한 캡처"/>:<span><Icon name="select-area" size={18}/>{failed?'캡처 다시 불러오기':'캡처 불러오는 중…'}</span>}<small>화면 캡처 <Icon name="search" size={13}/></small></button>;
}
