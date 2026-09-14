"use client";
import {useEffect,useRef,useState} from 'react';
import {GoogleAuthProvider,reauthenticateWithPopup,signOut} from 'firebase/auth';
import {AccountControl,useTrainer} from './auth-gate';
import {getClientAuth} from '../lib/firebase-client';
import {Icon} from './icons';
import {defaultDisplayPreferences,type DisplayPreferences} from '../lib/display-preferences';
import {listenUsage,serverAiEnabled,aiMessage,callAccount,type AiUsage} from '../lib/server-ai';
const tabs=[['display','화면 설정','panel'],['account','계정','users'],['usage','AI 이용량','spark'],['feedback','개선 의견','edit']] as const;
export function SettingsDialog({open,onClose,preferences:p,onChange,saveError,beforeLogout}:{open:boolean;onClose:()=>void;preferences:DisplayPreferences;onChange:(patch:Partial<DisplayPreferences>)=>void;saveError:string;beforeLogout:()=>boolean}){
 const user=useTrainer(),dialog=useRef<HTMLDialogElement>(null),feedbackId=useRef('');
 const [tab,setTab]=useState<string>('display'),[usage,setUsage]=useState<AiUsage|null>(null),[usageError,setUsageError]=useState('');
 const [topic,setTopic]=useState('회원 홈'),[message,setMessage]=useState(''),[contact,setContact]=useState(user.email||''),[sending,setSending]=useState(false),[receipt,setReceipt]=useState(''),[feedbackError,setFeedbackError]=useState('');
 const [deleting,setDeleting]=useState(false),[confirmDelete,setConfirmDelete]=useState(false),[deleteText,setDeleteText]=useState(''),[deleteError,setDeleteError]=useState('');
 useEffect(()=>{if(!open){dialog.current?.close();return;}const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus();};},[open]);
 useEffect(()=>{if(!open||tab!=='usage'||!serverAiEnabled)return;setUsage(null);setUsageError('');return listenUsage(setUsage,e=>setUsageError(aiMessage(e)));},[open,tab,user.uid]);
 async function sendFeedback(){if(sending||!message.trim())return;setSending(true);setFeedbackError('');if(!feedbackId.current)feedbackId.current=crypto.randomUUID();try{const result=await callAccount({action:'feedback',requestId:feedbackId.current,topic,message,contact});setReceipt(result.receiptId??'');setMessage('');feedbackId.current='';}catch(e){setFeedbackError(aiMessage(e));}finally{setSending(false);}}
 async function removeAccount(){if(deleting||deleteText!=='탈퇴')return;setDeleting(true);setDeleteError('');try{
  await reauthenticateWithPopup(user,new GoogleAuthProvider());await user.getIdToken(true);
  await callAccount({action:'deleteAccount',confirmed:true});
  try{localStorage.removeItem(`trainer-note:display:v1:${user.uid}`);}catch{}
  await signOut(getClientAuth());
 }catch(e){setDeleteError(aiMessage(e));}finally{setDeleting(false);}}
 const editFeedback=()=>{feedbackId.current='';setReceipt('');setFeedbackError('');};
 return <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title" onCancel={e=>{e.preventDefault();if(!deleting)onClose();}}>
  <header className="settings-header"><h2 id="settings-title">설정</h2><button className="icon-button" disabled={deleting} aria-label="설정 닫기" onClick={onClose}><Icon name="close" size={22}/></button></header>
  <div className="settings-layout"><nav className="settings-nav" aria-label="설정 메뉴">{tabs.map(([id,label,icon])=><button key={id} disabled={deleting} aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}><Icon name={icon} size={19}/><span>{label}</span></button>)}</nav><div className="settings-content">
  {tab==='display'&&<section><h3>화면 설정</h3>
   <div className="settings-row"><strong>테마</strong><div className="segmented" aria-label="테마">{(['light','dark','system'] as const).map((v,i)=><button key={v} aria-pressed={p.theme===v} className={p.theme===v?'selected':''} onClick={()=>onChange({theme:v})}>{['라이트','다크','시스템'][i]}</button>)}</div></div>
   <div className="settings-row"><strong>글꼴</strong><div className="segmented" aria-label="글꼴">{(['original','system'] as const).map((v,i)=><button key={v} aria-pressed={p.font===v} className={p.font===v?'selected':''} onClick={()=>onChange({font:v})}>{['기존 글꼴','시스템 글꼴'][i]}</button>)}</div></div>
   <div className="settings-row"><strong>기본 글자 크기</strong><div className="segmented" aria-label="기본 글자 크기">{([100,112.5,125] as const).map(v=><button key={v} aria-pressed={p.textScale===v} className={p.textScale===v?'selected':''} onClick={()=>onChange({textScale:v})}>{v}%</button>)}</div></div>
   <div className="settings-row"><strong>작업실 기본 보기</strong><div className="segmented" aria-label="기본 작업실 보기">{([2,3] as const).map(v=><button key={v} aria-pressed={p.viewMode===v} className={p.viewMode===v?'selected':''} onClick={()=>onChange({viewMode:v})}>{v}뷰</button>)}</div></div>
   <fieldset className="settings-ratios"><legend>2뷰 너비</legend><p>원본 {Math.round(p.twoRatio)}% · 작업 {Math.round(100-p.twoRatio)}%</p><input type="range" aria-label="2뷰 원본 너비" min="25" max="65" step="1" value={p.twoRatio} onChange={e=>onChange({twoRatio:Number(e.target.value)})}/></fieldset>
   <fieldset className="settings-ratios"><legend>3뷰 너비</legend><p>원본 {Math.round(p.threeRatio[0])}% · 작업 {Math.round(p.threeRatio[1])}% · 우측 {Math.round(p.threeRatio[2])}%</p>
    <label>원본<input type="range" aria-label="3뷰 원본 너비" min="15" max={Math.min(40,75-p.threeRatio[2])} value={p.threeRatio[0]} onChange={e=>{const v=Number(e.target.value);onChange({threeRatio:[v,100-v-p.threeRatio[2],p.threeRatio[2]]});}}/></label>
    <label>우측<input type="range" aria-label="3뷰 우측 너비" min="15" max={Math.min(40,75-p.threeRatio[0])} value={p.threeRatio[2]} onChange={e=>{const v=Number(e.target.value);onChange({threeRatio:[p.threeRatio[0],100-v-p.threeRatio[0],v]});}}/></label>
   </fieldset><p className="settings-note">너비는 열린 작업실에도 적용됩니다. 좁은 화면에서는 2뷰 또는 세로 배치로 전환됩니다.</p>
   <div className="settings-row"><strong>회원 카드 크기</strong><div className="segmented">{(['small','medium','large'] as const).map((v,i)=><button key={v} aria-pressed={p.cardSize===v} className={p.cardSize===v?'selected':''} onClick={()=>onChange({cardSize:v})}>{['작게','보통','크게'][i]}</button>)}</div></div>
   <div className="settings-row"><strong>회원 정렬</strong><select aria-label="설정 회원 정렬" value={p.sort} onChange={e=>onChange({sort:e.target.value as DisplayPreferences['sort']})}><option value="recent">최근 등록순</option><option value="name">이름순</option></select></div>
   <p className="settings-note">이 브라우저에서 계정별로 저장됩니다. 기본 보기는 새로 여는 작업실에 적용됩니다.</p>{saveError&&<p className="file-error" role="status">{saveError}</p>}<button className="settings-reset" onClick={()=>onChange({...defaultDisplayPreferences})}>화면 설정 초기화</button>
  </section>}
  {tab==='account'&&<section><h3>계정</h3><AccountControl beforeLogout={beforeLogout}/><div className="settings-info"><strong>회원 기록은 계정에 연결돼요</strong><p>같은 Google 계정으로 로그인하면 다른 기기에서도 기록을 확인할 수 있어요.</p></div>
   <div className="settings-delete"><h4>회원탈퇴</h4><p>이 계정의 모든 회원, 운동 기록, 대화, 목표, 문의와 원본 파일을 삭제합니다. 복구할 수 없습니다.</p>
    {!confirmDelete?<button className="danger" onClick={()=>setConfirmDelete(true)}>회원탈퇴</button>:<><p><strong>{user.email}</strong> 계정에서 탈퇴합니다. Google 계정 자체는 삭제되지 않습니다.</p><label className="settings-field">확인을 위해 ‘탈퇴’ 입력<input aria-label="탈퇴 확인" value={deleteText} onChange={e=>setDeleteText(e.target.value)} autoComplete="off" disabled={deleting}/></label><p className="settings-note">Google 재인증 후 접근을 해제합니다. 진행 중인 작업이 끝나면 기록과 파일을 몇 분 내 삭제하며, 삭제 실패 시 서버에서 재시도합니다.</p><div className="settings-feedback-actions"><button disabled={deleting} onClick={()=>{setConfirmDelete(false);setDeleteText('');}}>취소</button><button className="danger" disabled={deleting||deleteText!=='탈퇴'} onClick={()=>void removeAccount()}>{deleting?'탈퇴 처리 중…':'Google 확인 후 탈퇴'}</button></div></>}
    {deleteError&&<p className="file-error" role="alert">{deleteError}</p>}
   </div></section>}
  {tab==='usage'&&<section><h3>AI 이용량</h3><p className="settings-intro">이번 달 · 한국 시간 기준</p>
   <div className="settings-info"><strong>Gemini 응답의 실제 토큰을 누적해요</strong><p>이 앱에서 사용한 계정별 집계입니다. Google AI Studio 전체 프로젝트 이용량이나 청구서를 동기화한 값은 아닙니다.</p></div>
   {!serverAiEnabled?<p>AI 서버 연결을 준비하고 있어요.</p>:usageError?<p className="file-error">{usageError}</p>:!usage?<p role="status">이용량을 불러오고 있어요…</p>:<><div className="settings-usage"><div><span>API 요청 시도</span><strong>{(usage.calls??0).toLocaleString()}<small>회</small></strong></div><div><span>입력 토큰</span><strong>{(usage.inputTokens??0).toLocaleString()}</strong></div><div><span>출력 토큰</span><strong>{(usage.outputTokens??0).toLocaleString()}</strong></div></div><div className="settings-info"><strong>예상 API 원가 ${((usage.usedMicros??0)/1e6).toFixed(4)}</strong><p>응답 토큰 × 모델 단가 + 검색 비용 추정치. 무료 제공량·크레딧·세금·환율·서버/저장소 비용은 반영하지 않아 실제 청구액과 다를 수 있어요.</p>{!!usage.reservedMicros&&<p>처리 중 예약액 ${((usage.reservedMicros??0)/1e6).toFixed(4)} · 완료 후 실제 사용량으로 정산</p>}</div><p className="settings-note">요청 시도에는 실패·검색 안전 확인·검색이 포함되어 질문 수와 다릅니다. 저장된 답변 다시 보기에는 AI를 호출하지 않아요. 질문 횟수 제한은 없습니다.</p>{usage.measuredCalls!==undefined&&<p className="settings-note">집계 개선 이후: 완료 {usage.completedCalls??0}회 · 실패 {usage.failedCalls??0}회 · 소요 시간 평균 {((usage.totalDurationMs??0)/Math.max(1,usage.measuredCalls)/1000).toFixed(1)}초</p>}</>}
  </section>}
  {tab==='feedback'&&<section><h3>개선 의견</h3><label className="settings-field">관련 화면<select value={topic} disabled={sending} onChange={e=>{setTopic(e.target.value);editFeedback();}}>{['회원 홈','기록 수정','진행 분석','다음 수업','AI 도우미','업로드','설정','기타'].map(v=><option key={v}>{v}</option>)}</select></label><label className="settings-field">의견<textarea rows={5} maxLength={2000} disabled={sending} value={message} onChange={e=>{setMessage(e.target.value);editFeedback();}} placeholder="불편했던 상황과 기대한 동작을 알려주세요."/></label><label className="settings-field">답장 받을 연락처 · 선택<input maxLength={150} disabled={sending} value={contact} onChange={e=>{setContact(e.target.value);editFeedback();}}/></label><p className="settings-note">작성한 내용과 연락처를 개발자 문의함으로 전송합니다. 회원 기록·캡처는 자동 첨부하지 않아요.</p><button className="primary" disabled={!message.trim()||sending} onClick={()=>void sendFeedback()}>{sending?'전송 중…':'개발자에게 전송'}</button>{receipt&&<p className="settings-note" role="status">접수 완료 · {receipt.slice(0,8)}</p>}{feedbackError&&<p className="file-error" role="alert">{feedbackError}</p>}</section>}
  </div></div></dialog>;
}
