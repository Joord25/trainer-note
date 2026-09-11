"use client";

import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import type {SourceSelection} from './assistant-chat';
import type {PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask} from 'pdfjs-dist';
import {readMemberFile, fileError, type MemberFile} from '../lib/member-files';

type Viewport = RefObject<HTMLDivElement | null>;
type Position = {fileId: string; page: number; total: number};

/** Originals stay separate in Storage; only the browser presentation is continuous. */
export function ContinuousSourceViewer({memberId, files, selectedFile, sourcePage = 1, selectionMode=false, onSelection, jumpRequest=0}: {
  memberId: string; files: MemberFile[]; selectedFile: string; sourcePage?: number; selectionMode?:boolean; onSelection?:(s:SourceSelection)=>void; jumpRequest?:number;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState<Position | null>(null);
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(Math.max(180, el.clientWidth - 32)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selectedFile === 'all') viewport.current?.scrollTo({top: 0});
  }, [selectedFile]);
  const index = files.findIndex(file => file.id === position?.fileId);
  return <div className="original-viewer">
    <div className="original-controls">
      <span aria-live="polite">{index >= 0 ? `파일 ${index + 1} / ${files.length} · ${position!.page} / ${position!.total}쪽` : `원본 ${files.length}개 · 연속 보기`}</span>
      <div className="original-zoom">
        <button aria-label="원본 축소" disabled={zoom <= 75} onClick={() => setZoom(v => v - 25)}>−</button>
        <button aria-label="원본 너비 맞춤" onClick={() => setZoom(100)}>{zoom === 100 ? '너비 맞춤' : `${zoom}%`}</button>
        <button aria-label="원본 확대" disabled={zoom >= 200} onClick={() => setZoom(v => v + 25)}>+</button>
      </div>
    </div>
    <div className="original-scroll" ref={viewport} tabIndex={0} aria-label="모든 원본 연속 보기">
      <div className="original-stream" style={{width: Math.round(width * zoom / 100)}}>
        {files.map((file, i) => <SourceDocument key={`${memberId}/${file.id}`} memberId={memberId} file={file}
          index={i + 1} viewport={viewport} width={Math.round(width * zoom / 100)}
          selected={selectedFile === file.id} sourcePage={sourcePage} onPosition={setPosition} selectionMode={selectionMode} onSelection={onSelection} jumpRequest={jumpRequest}/>) }
        <p className="original-end">원본 {files.length}개 · 마지막 파일이에요</p>
      </div>
    </div>
  </div>;
}

function useNearby(ref: RefObject<HTMLElement | null>, viewport: Viewport, margin: string, once = false) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.some(entry => entry.isIntersecting);
      setNear(visible);
      if (visible && once) observer.disconnect();
    }, {root: viewport.current, rootMargin: margin});
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, viewport, margin, once]);
  return near;
}

function SourceDocument({memberId, file, index, viewport, width, selected, sourcePage, onPosition, selectionMode, onSelection, jumpRequest}: {
  memberId: string; file: MemberFile; index: number; viewport: Viewport; width: number;
  selected: boolean; sourcePage: number; onPosition: (p: Position) => void; selectionMode:boolean; onSelection?: (s:SourceSelection)=>void; jumpRequest:number;
}) {
  const container = useRef<HTMLElement>(null);
  const near = useNearby(container, viewport, '600px', true);
  const [attempt, setAttempt] = useState(0);
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [requested, setRequested] = useState(false);
  const [imageError, setImageError] = useState(false);
  useEffect(() => {if (near || selected) setRequested(true);}, [near, selected]);
  useEffect(() => {
    if (!requested || file.status !== 'ready') return;
    let live = true, objectUrl = '', task: PDFDocumentLoadingTask | undefined;
    setError(''); setUrl(''); setDocument(null); setImageError(false);
    void (async () => {
      try {
        const blob = await readMemberFile(memberId, file.id, file.contentType);
        if (!live) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
        if (file.contentType !== 'application/pdf') return;
        const pdfjs = await import('pdfjs-dist');
        if (!live) return;
        const assets = `/pdfjs/${pdfjs.version}/`;
        pdfjs.GlobalWorkerOptions.workerSrc = `${assets}pdf.worker.min.mjs`;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (!live) return;
        task = pdfjs.getDocument({data: bytes, cMapUrl: `${assets}cmaps/`, cMapPacked: true,
          standardFontDataUrl: `${assets}standard_fonts/`, wasmUrl: `${assets}wasm/`,
          iccUrl: `${assets}iccs/`});
        // Password-protected files must not leave an indefinite loading indicator.
        task.onPassword = () => {if (live) setError('암호가 걸린 PDF예요. 원본 크게 보기에서 열거나 암호를 해제한 파일을 올려주세요.'); void task?.destroy();};
        const pdf = await task.promise;
        if (live) setDocument(pdf);
      } catch (e) {
        if (live) setError(previous => previous || (objectUrl
          ? '이 파일의 미리보기를 만들지 못했어요. 원본 크게 보기로 확인하거나 다시 시도해주세요.'
          : fileError(e)));
      }
    })();
    return () => {live = false; if (objectUrl) URL.revokeObjectURL(objectUrl); void task?.destroy();};
  }, [requested, memberId, file.id, file.contentType, file.status, attempt]);
  const total = document?.numPages ?? 1;
  const page = Math.min(total, Math.max(1, sourcePage));
  const pendingJump = useRef(false);
  const jump = useCallback(() => {
    const el = page === 1 ? container.current : container.current?.querySelector<HTMLElement>(`[data-source-page="${page}"]`);
    const root = viewport.current;
    if (el && root) root.scrollTop += el.getBoundingClientRect().top - root.getBoundingClientRect().top - 16;
  }, [page, viewport]);
  useEffect(() => {
    if (!selected) {pendingJump.current = false; return;}
    pendingJump.current = true;
    jump();
    // If the trainer starts scrolling while a PDF loads, keep their position.
    const root = viewport.current;
    const cancel = () => {pendingJump.current = false;};
    root?.addEventListener('wheel', cancel, {passive: true});
    root?.addEventListener('touchstart', cancel, {passive: true});
    root?.addEventListener('keydown', cancel);
    return () => {root?.removeEventListener('wheel', cancel); root?.removeEventListener('touchstart', cancel); root?.removeEventListener('keydown', cancel);};
  }, [selected, document, jump, viewport, jumpRequest]);
  const pageReady = useCallback(() => {
    if (!pendingJump.current) return;
    requestAnimationFrame(() => {if (pendingJump.current) {jump(); pendingJump.current = false;}});
  }, [jump]);
  return <section className="original-document" ref={container} data-source-file={file.id} aria-label={`원본 ${index}: ${file.name}`}>
    <header className="original-file-heading"><span className="original-file-number">{String(index).padStart(2, '0')}</span>
      <div><strong title={file.name}>{file.name}</strong><small>{file.contentType === 'application/pdf' ? `PDF${document ? ` · ${total}쪽` : ''}` : '이미지 · 1쪽'}</small></div>
      {url && <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`${file.name} 원본 크게 보기`}>크게 보기 ↗</a>}
    </header>
    {file.status !== 'ready' ? <p className="original-placeholder" role="status">{file.status === 'deleting' ? '삭제 중인 원본이에요.' : '원본을 저장하고 있어요…'}</p>
      : error || imageError ? <div className="original-placeholder" role="alert"><p>{error || '이미지를 표시할 수 없어요. 파일을 다시 확인해주세요.'}</p><button onClick={() => setAttempt(v => v + 1)}>원본 다시 불러오기</button></div>
      : document ? Array.from({length: total}, (_, i) => <SourcePage key={i} fileId={file.id} number={i + 1} total={total} viewport={viewport} onPosition={onPosition} selectionMode={selectionMode} onSelection={onSelection} fileName={file.name}>
          <PdfCanvas pdf={document} number={i + 1} width={width} viewport={viewport} onReady={i + 1 === page ? pageReady : undefined}/>
        </SourcePage>)
      : url && file.contentType !== 'application/pdf' ? <SourcePage fileId={file.id} number={1} total={1} viewport={viewport} onPosition={onPosition} selectionMode={selectionMode} onSelection={onSelection} fileName={file.name}>
          <img src={url} alt={`${file.name} 원본`} onLoad={pageReady} onError={() => setImageError(true)}/>
        </SourcePage>
      : <p className="original-placeholder" role="status">{requested ? '원본을 불러오고 있어요…' : '스크롤하면 원본을 불러와요'}</p>}
  </section>;
}

function SourcePage({fileId, number, total, viewport, onPosition, children, selectionMode, onSelection, fileName}: {
  fileId: string; number: number; total: number; viewport: Viewport;
  onPosition: (p: Position) => void; children: React.ReactNode; selectionMode:boolean; onSelection?: (s:SourceSelection)=>void; fileName:string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) onPosition({fileId, page: number, total});
    }, {root: viewport.current, rootMargin: '0px 0px -65% 0px'});
    observer.observe(el);
    return () => observer.disconnect();
  }, [fileId, number, total, viewport, onPosition]);
  return <div className="original-page" ref={ref} data-source-page={number}>
    <PageSelection enabled={selectionMode} onSelect={value=>onSelection?.({fileId,fileName,page:number,...value})}>{children}</PageSelection><span className="original-page-label">{number} / {total}</span>
  </div>;
}

function PdfCanvas({pdf, number, width, viewport, onReady}: {pdf: PDFDocumentProxy; number: number; width: number; viewport: Viewport; onReady?: () => void}) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useNearby(ref, viewport, '600px');
  const [ratio, setRatio] = useState(1 / Math.SQRT2);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!near || !ref.current) return;
    let live = true, render: RenderTask | undefined;
    const host = ref.current;
    setError(false);
    void (async () => {
      try {
        const page = await pdf.getPage(number);
        if (!live) return;
        const natural = page.getViewport({scale: 1});
        setRatio(natural.width / natural.height);
        const size = page.getViewport({scale: width / natural.width});
        // Bound each canvas even on high-DPI displays and very tall pages.
        const density = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(4_000_000 / (size.width * size.height)));
        const canvas = window.document.createElement('canvas');
        canvas.width = Math.ceil(size.width * density); canvas.height = Math.ceil(size.height * density);
        canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `PDF 원본 ${number}쪽`);
        host.replaceChildren(canvas);
        render = page.render({canvas, viewport: size, transform: [density, 0, 0, density, 0, 0]});
        await render.promise;
        if (live) onReady?.();
      } catch (e) {
        if (live && (e as Error).name !== 'RenderingCancelledException') setError(true);
      }
    })();
    return () => {live = false; render?.cancel(); host.replaceChildren();};
  }, [pdf, number, width, near, onReady]);
  return <div className="original-canvas-wrap" style={{aspectRatio: ratio}}>
    <div ref={ref} className="original-canvas"/>
    {error && <p role="alert">이 페이지를 표시하지 못했어요. 위 ‘크게 보기’에서 확인해주세요.</p>}
  </div>;
}

function PageSelection({enabled,onSelect,children}:{enabled:boolean;onSelect:(v:Pick<SourceSelection,'rect'|'image'>)=>void;children:React.ReactNode}){
 const host=useRef<HTMLDivElement>(null),start=useRef<{x:number;y:number}|null>(null);
 const [box,setBox]=useState<{x:number;y:number;width:number;height:number}|null>(null),[error,setError]=useState('');
 function point(e:React.PointerEvent){const b=host.current!.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-b.left)/b.width)),y:Math.max(0,Math.min(1,(e.clientY-b.top)/b.height))};}
 function capture(rect:{x:number;y:number;width:number;height:number}){
  const source=host.current?.querySelector<HTMLCanvasElement|HTMLImageElement>('canvas,img');if(!source){setError('페이지가 표시된 뒤 선택해주세요.');return;}
  const w=source instanceof HTMLImageElement?source.naturalWidth:source.width,h=source instanceof HTMLImageElement?source.naturalHeight:source.height;if(!w||!h)return;
  const out=document.createElement('canvas'),scale=Math.min(1,1000/Math.max(w*rect.width,h*rect.height));out.width=Math.max(1,Math.round(w*rect.width*scale));out.height=Math.max(1,Math.round(h*rect.height*scale));const ctx=out.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,out.width,out.height);ctx.drawImage(source,rect.x*w,rect.y*h,rect.width*w,rect.height*h,0,0,out.width,out.height);
  const image=out.toDataURL('image/jpeg',.75);if(image.length>500000){setError('더 작은 영역을 선택해주세요.');return;}setError('');onSelect({rect,image});
 }
 return <div className="original-selectable" ref={host}>{children}{enabled&&<div className="original-selection-layer" role="group" aria-label="질문할 원본 영역 선택" onPointerDown={e=>{if((e.target as HTMLElement).closest('button'))return;start.current=point(e);setBox(null);e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{const a=start.current;if(!a)return;const b=point(e);setBox({x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)});}} onPointerUp={e=>{const a=start.current;start.current=null;if(!a)return;const b=point(e),rect={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),width:Math.abs(a.x-b.x),height:Math.abs(a.y-b.y)};setBox(null);if(rect.width>.02&&rect.height>.02)capture(rect);}} onPointerCancel={()=>{start.current=null;setBox(null);}}>
 <button type="button" onClick={()=>capture({x:0,y:0,width:1,height:1})}>이 페이지 전체 질문</button>{box&&<span className="original-selection-box" style={{left:box.x*100+'%',top:box.y*100+'%',width:box.width*100+'%',height:box.height*100+'%'}}/>}</div>}{error&&<p role="alert">{error}</p>}</div>;
}
