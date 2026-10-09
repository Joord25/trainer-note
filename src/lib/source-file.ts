// Finder can expose a slash in a date as a colon in the browser's File.name.
// Normalize only a trailing month/day label for display; keep stored names intact.
export function sourceDisplayName(name:string,displayName?:string):string {
  if(displayName)return displayName;
  return name.replace(/(^|\s)(0?[1-9]|1[0-2]):(0?[1-9]|[12]\d|3[01])(?=\.(?:pdf|png|jpe?g)$)/i,(match,prefix,month,day)=>{
    const days=[31,29,31,30,31,30,31,31,30,31,30,31];
    return Number(day)<=days[Number(month)-1]?`${prefix}${month}/${day}`:match;
  });
}

export const MAX_SOURCE_BYTES = 50 * 1024 * 1024;
export type SourceContentType = "application/pdf" | "image/png" | "image/jpeg";
export function sourceObjectName(contentType:SourceContentType) {
  if(contentType==='application/pdf')return 'source.pdf';
  if(contentType==='image/png')return 'source.png';
  if(contentType==='image/jpeg')return 'source.jpg';
  throw new Error("지원하지 않는 파일 형식이에요.");
}
// Check the extension against bytes, not the browser-supplied MIME label.
// This is a format signature check, not full parsing or malware scanning.
export async function inspectSourceFile(file:File):Promise<{id:string;contentType:SourceContentType}> {
  if(!file.size)throw new Error("비어 있는 파일이에요. 내용이 있는 파일을 선택해주세요.");
  if(file.size>MAX_SOURCE_BYTES)throw new Error("업로드 가능한 파일 크기를 초과했어요. 다른 파일은 계속 올릴 수 있어요.");
  if(file.name.length>200)throw new Error("파일 이름을 200자 이내로 줄여주세요.");
  const extension=file.name.split('.').pop()?.toLowerCase();
  if(!extension||!['pdf','png','jpg','jpeg'].includes(extension))throw new Error("PDF, PNG, JPG, JPEG 파일을 선택해주세요.");
  const bytes=await file.arrayBuffer(),header=new Uint8Array(bytes,0,Math.min(bytes.byteLength,8));
  const pdf=new TextDecoder().decode(header.slice(0,5))==='%PDF-';
  const png=[137,80,78,71,13,10,26,10].every((v,i)=>header[i]===v);
  const jpeg=header[0]===255&&header[1]===216&&header[2]===255;
  const contentType:SourceContentType=extension==='pdf'?'application/pdf':extension==='png'?'image/png':'image/jpeg';
  if(!(contentType==='application/pdf'?pdf:contentType==='image/png'?png:jpeg))throw new Error("확장자와 실제 파일 형식이 맞지 않아요. 원본 PDF·PNG·JPEG 파일을 선택해주세요.");
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return {id:Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join(''),contentType};
}

export type ExistingSource = {id:string;name:string;status:string;originalRemoved:boolean};
export class DuplicateSourceError extends Error {
  readonly existing:ExistingSource;
  constructor(id:string,source:{name:string;displayName?:string;status:string;originalRemoved?:boolean}) {
    const name=sourceDisplayName(source.name,source.displayName);
    const detail=source.originalRemoved?'원본은 정리됐지만 연결된 기록이 남아 있어요.':source.status==='uploading'?'이전 업로드가 완료되지 않았어요. 목록에서 저장 확인을 눌러주세요.':source.status==='deleting'?'이 파일의 삭제가 진행 중이에요. 삭제를 마친 뒤 다시 올려주세요.':'파일명이 달라도 내용이 같아 다시 저장하지 않았어요.';
    super(`기존 파일 ‘${name}’과 내용이 같아요. ${detail}`);
    this.name='DuplicateSourceError';
    this.existing={id,name,status:source.status,originalRemoved:source.originalRemoved===true};
  }
}
