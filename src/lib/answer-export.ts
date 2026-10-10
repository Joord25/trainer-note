import type {ChatMessage} from './server-ai';
export const ANSWER_EXPORT_CSS=`
*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#29362f;font-family:Arial,"Apple SD Gothic Neo","Malgun Gothic",sans-serif}
.answer-export{width:800px;padding:40px;font-size:15px;line-height:1.8;letter-spacing:-.02em;overflow-wrap:anywhere}
.answer-export h1{font-size:22px;margin:0 0 28px;padding-bottom:16px;border-bottom:1px solid #dfe5df}
.answer-export h4{font-size:18px;margin:26px 0 12px;break-after:avoid}.answer-export p{margin:0 0 16px;white-space:pre-line;orphans:3;widows:3}
.answer-export ul,.answer-export ol{margin:14px 0 22px;padding-left:24px}.answer-export li{margin:10px 0}.assistant-point-title{font-weight:650}
.answer-export strong{font-weight:700}.answer-key-point{background:#e5f1e9}.answer-export a{color:#345b42;text-decoration:underline}
.assistant-table-scroll{overflow:visible;margin:20px 0}.answer-export table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:14px;line-height:1.7}
.answer-export th,.answer-export td{padding:12px;vertical-align:top;text-align:left;border:1px solid #dfe5df;word-break:normal;overflow-wrap:anywhere}
.answer-export th{background:#f2f5f1;font-weight:700}.answer-export thead{display:table-header-group}.answer-export tr{break-inside:avoid}
.answer-export-sources{margin-top:28px;border-top:1px solid #dfe5df;padding-top:18px;font-size:12px;line-height:1.65}
.answer-export-sources h2{font-size:14px;margin:0 0 12px}.answer-export-sources a{display:block;overflow-wrap:anywhere}.answer-export-sources li{margin:10px 0}
.answer-export-notice{font-size:12px;color:#66736a;margin-top:20px}
@page{size:A4;margin:16mm}@media print{.answer-export{width:auto;padding:0}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:inherit}}
`;
export function exportSources(sources:ChatMessage['webSources']=[]){return sources.filter(source=>{try{const u=new URL(source.url);return u.protocol==='https:'&&!u.username&&!u.password;}catch{return false;}});}
export function buildAnswerExport(doc:Document,body:HTMLElement,message:ChatMessage){
 const root=doc.createElement('article');root.className='answer-export';
 const title=doc.createElement('h1');title.textContent='AI 도우미 답변';root.append(title);
 const answer=doc.importNode(body,true);
 answer.querySelectorAll('[role="tooltip"],[popover],button,iframe,script,style').forEach(el=>el.remove());
 answer.querySelectorAll('[id],[style],[tabindex],[aria-describedby]').forEach(el=>{for(const name of ['id','style','tabindex','aria-describedby'])el.removeAttribute(name);});
 root.append(answer);
 const sources=exportSources(message.webSources);
 if(sources.length){const section=doc.createElement('section');section.className='answer-export-sources';const heading=doc.createElement('h2');heading.textContent='참고 출처';section.append(heading);const list=doc.createElement('ol');for(const source of sources){const item=doc.createElement('li'),link=doc.createElement('a');item.append(doc.createTextNode(source.title));link.href=source.url;link.textContent=source.url;item.append(link);list.append(item);}section.append(list);root.append(section);}
 if(message.searchNotice){const notice=doc.createElement('p');notice.className='answer-export-notice';notice.textContent=message.searchNotice;root.append(notice);}
 return root;
}
export async function saveAnswer(body:HTMLElement,message:ChatMessage,format:'pdf'|'png'){
 const frame=document.createElement('iframe');frame.title='AI 답변 저장 미리보기';frame.style.cssText='position:fixed;left:-10000px;top:0;width:800px;height:1000px;border:0;pointer-events:none';document.body.append(frame);
 let printing=false;
 try{
  const doc=frame.contentDocument;if(!doc)throw Error('저장 화면을 만들지 못했어요.');
  doc.documentElement.lang='ko';doc.title='트레이너 노트 - AI 답변';
  const style=doc.createElement('style');style.textContent=ANSWER_EXPORT_CSS;doc.head.append(style);
  const root=buildAnswerExport(doc,body,message);doc.body.append(root);await doc.fonts.ready;
  if(format==='pdf'){frame.contentWindow!.focus();frame.contentWindow!.print();printing=true;return;}
  const {default:html2canvas}=await import('html2canvas');
  const height=Math.ceil(root.getBoundingClientRect().height),scale=Math.min(2,16000/height,Math.sqrt(24000000/(800*height)));
  if(scale<.5)throw Error('답변이 길어 PNG 한 장에 담기 어려워요. PDF로 저장해주세요.');
  const canvas=await html2canvas(root,{backgroundColor:'#ffffff',width:800,height,windowWidth:800,windowHeight:height,scale,logging:false});
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('PNG 파일을 만들지 못했어요.')),'image/png'));
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`트레이너노트-AI답변-${message.id.slice(0,8)}.png`;doc.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 }finally{if(printing)setTimeout(()=>frame.remove(),60000);else frame.remove();}
}
