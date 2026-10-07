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
