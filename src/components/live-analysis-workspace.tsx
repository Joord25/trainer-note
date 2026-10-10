"use client";
import {WorkspaceToast} from "./workspace-toast";
import {uploadSummaryText} from "../lib/upload-result";
import {AnalysisControlsMenu} from './analysis-controls-menu';
import {AutoHideAnalysisTabs} from './auto-hide-analysis-tabs';
import {RegionExerciseList} from './region-exercise-list';
import type {ChangeRegion} from './change-evidence-card';
import {CoachingJourney,type CoachingContext} from './coaching-journey';
import {savedWorkspacePane} from '../lib/workspace-entry';
import {PreviousLessons} from './previous-lessons';
import {useGoalVisual} from './use-goal-visual';
import {listenAssessmentResults} from '../lib/assessment-store';
import type {AssessmentResult} from '../lib/assessment-results';
import {ConnectedLessonPlan} from './connected-lesson-plan';
import {eligibleAnalysisRecords,goalVisualInputKey} from '../lib/goal-visual';
import {mergeSessionNotes} from '../lib/workout-extraction';
import {listenSessionNotes,type SessionNote} from '../lib/session-notes';
import {visibleUnparsed} from '../lib/review-alerts';
import {useEffect,useRef,useState} from 'react';
import {DockablePanel} from './dockable-panel';
import {usePanelTransition} from './panel-transition';
import {ScreenCapture} from './screen-capture';
import {AnalysisTools} from './analysis-tools';
import {analysisWindow,exerciseGroups,type PerformanceMetric} from '../lib/progress-analysis';
import {BodyDistribution,PerformanceTrend,GoalEvaluation} from './progress-details';
import {ProgressSummary} from './progress-summary';
import {TrainingGoalDialog} from './training-goal-dialog';
import {listenTrainingGoal} from '../lib/training-goal-store';
import type {SavedTrainingGoal} from '../lib/training-goals';
import {Icon} from './icons';
import {ContinuousSourceViewer} from './continuous-source-viewer';
import {ResizableReviewColumns} from './resizable-review-columns';
import {AssistantChat,type SourceSelection,type AssistantDraft} from './assistant-chat';
import {AnalysisSource,sourceRows} from './analysis-source';
import {MemberFiles} from './member-files';
import {listenMemberFiles,type MemberFile} from '../lib/member-files';
import {listenWorkouts,type WorkoutRecord} from '../lib/workout-records';
import {serverAiEnabled,aiMessage,callAi,listenAiDocument,listenImports,type Analysis,type SavedImport,type SavedPlan} from '../lib/server-ai';
type Pane='source'|'analysis'|'direction'|'previous'|'plan';
export function LiveAnalysisWorkspace({memberId,memberName,goal,online,uploadRequest=0,goalRequest=0,onUnsavedChange,initialViewMode=2,onBack}:{onBack:()=>void;memberId:string;memberName:string;goal:string;online:boolean;uploadRequest?:number;goalRequest?:number;initialViewMode?:2|3;onUnsavedChange?:(value:boolean)=>void}){
 const [recordToolsHost,setRecordToolsHost]=useState<HTMLDivElement|null>(null);
 const previousContent=useRef<HTMLDivElement>(null);
 const [assessmentResults,setAssessmentResults]=useState<AssessmentResult[]>([]),[assessmentLoaded,setAssessmentLoaded]=useState(false),[recordsLoaded,setRecordsLoaded]=useState(false);
 const [savedSessionNotes,setSessionNotes]=useState<SessionNote[]>([]);
 const [trainingGoal,setTrainingGoal]=useState<SavedTrainingGoal|null>(null),[goalLoaded,setGoalLoaded]=useState(false),[goalError,setGoalError]=useState(''),[goalOpen,setGoalOpen]=useState(false),[goalRetry,setGoalRetry]=useState(0);
 useEffect(()=>{setGoalLoaded(false);setGoalError('');setTrainingGoal(null);try{return listenTrainingGoal(memberId,v=>{setTrainingGoal(v);setGoalLoaded(true);setGoalError('');},e=>{setGoalError(aiMessage(e));});}catch(e){setGoalError(aiMessage(e));}},[memberId,goalRetry]);
 useEffect(()=>{if(goalRequest)setGoalOpen(true);},[goalRequest]);
 const [files,setFiles]=useState<MemberFile[]>([]),[imports,setImports]=useState<SavedImport[]>([]),[records,setRecords]=useState<WorkoutRecord[]>([]),[analysis,setAnalysis]=useState<Analysis|null>(null),[plan,setPlan]=useState<SavedPlan|null>(null),[filesLoaded,setFilesLoaded]=useState(false),[importsLoaded,setImportsLoaded]=useState(false),[analysisLoaded,setAnalysisLoaded]=useState(false),[error,setError]=useState('');
 const sessionNotes=mergeSessionNotes(imports,savedSessionNotes);
 const [mode,setMode]=useState<number>(initialViewMode),[pane,setPane]=useState<Pane>('source'),[tab,setTab]=useState('summary'),[selectedFile,setSelectedFile]=useState('all'),[selectedRow,setSelectedRow]=useState(''),[upload,setUpload]=useState(false),[originalRequest,setOriginalRequest]=useState(0),[uploadNotice,setUploadNotice]=useState(''),[busy,setBusy]=useState(false),[now,setNow]=useState(Date.now());
 const [planSettingsRequest,setPlanSettingsRequest]=useState(0);
 const [twoViewPanel,setTwoViewPanel]=useState<'work'|'assistant'|'insights'>('work');
 const assistantOnly=mode===2&&twoViewPanel!=='work';
 const [reviewing,setReviewing]=useState(true),[workflowReady,setWorkflowReady]=useState(false),[workflowRetry,setWorkflowRetry]=useState(0);
 useEffect(()=>{let live=true;if(!online||!serverAiEnabled)return;void callAi({action:'enableCoachingWorkflow',memberId}).then(()=>{if(live)setWorkflowReady(true);}).catch(e=>{if(live)setError(aiMessage(e));});return()=>{live=false;};},[memberId,online,workflowRetry]);
 const [entryChecked,setEntryChecked]=useState(!serverAiEnabled),[entryError,setEntryError]=useState(''),[entryRetry,setEntryRetry]=useState(0);
 const [initialContext,setInitialContext]=useState<{memberId:string;revision:string;value:CoachingContext}|null>(null);
 const [analysisRequested,setAnalysisRequested]=useState(false);
 const entryTouched=useRef(false);
 const workflowRevision=JSON.stringify([records.map(r=>[r.id,r.revision]),imports.map(i=>[i.id,i.revision,i.status]),trainingGoal?.revision,sessionNotes]);
 // Resolve saved server state once per entry. A browser-session flag is not evidence of a saved analysis.
 useEffect(()=>{
  if(entryChecked||!online||!serverAiEnabled||!filesLoaded||!importsLoaded||!recordsLoaded||!goalLoaded)return;
  let live=true;
  void callAi({action:'workflowContext',memberId}).then(value=>{
   if(!live)return;
   const context=value as unknown as CoachingContext;
   setInitialContext({memberId,revision:workflowRevision,value:context});setEntryError('');setEntryChecked(true);
   const next=savedWorkspacePane(context);
   if(next==='source'||entryTouched.current)return;
   setReviewing(false);setPane(next);setTab('summary');setSourceHidden(false);
   if(next==='analysis'){setMode(3);setRightPanel('insights');}
  }).catch(e=>{if(live){setEntryError(aiMessage(e));setEntryChecked(true);}});
  return()=>{live=false;};
 },[entryChecked,online,memberId,filesLoaded,importsLoaded,recordsLoaded,goalLoaded,workflowRevision,entryRetry]);
 const checkingEntry=serverAiEnabled&&online&&!entryChecked;
 useEffect(()=>{setAnalysisRequested(false);},[workflowRevision]);

 const [detailRegion,setDetailRegion]=useState<ChangeRegion|null>(null);
 const [regionDetails,setRegionDetails]=useState<{title:string;text:string}[]>([]);
 const [assistantDraft,setAssistantDraft]=useState<AssistantDraft|null>(null),[decisionsVersion,setDecisionsVersion]=useState(0);
 const [thumbnailsOpen,setThumbnailsOpen]=useState(false);
 const [rowOpenRequest,setRowOpenRequest]=useState(0);
 const [reviewJump,setReviewJump]=useState(0),[recordJump,setRecordJump]=useState(0),[sourceHidden,setSourceHidden]=useState(false),[selectionMode,setSelectionMode]=useState(false),[selection,setSelection]=useState<SourceSelection|null>(null),[sourcePage,setSourcePage]=useState(1),[originalFile,setOriginalFile]=useState(''),[jumpRequest,setJumpRequest]=useState(0);
 const [rightPanel,setRightPanel]=useState<'assistant'|'plan'|'insights'>('insights');
 const centerLessonTab=useRef<HTMLButtonElement>(null),rightLessonTab=useRef<HTMLButtonElement>(null);
 const centerPlanHost=useRef<HTMLDivElement>(null),rightPlanHost=useRef<HTMLDivElement>(null),lastWorkPane=useRef<Pane>('source');
 const planOnRight=mode===3&&rightPanel==='plan';
 const planDirty=useRef(false);
 const requestedFiles=useRef(new Set<string>()),requestedAnalysis=useRef(false),dirty=useRef(false),analysisScroll=useRef<HTMLDivElement>(null),journeyScroll=useRef<HTMLDivElement>(null);
 useEffect(()=>{const fail=(e:unknown)=>setError(aiMessage(e));const offs=[listenAssessmentResults(memberId,v=>{setAssessmentResults(v);setAssessmentLoaded(true);},fail),listenSessionNotes(memberId,setSessionNotes,fail),listenMemberFiles(memberId,(v,cached)=>{setFiles(v);if(!cached)setFilesLoaded(true);},fail),listenWorkouts(memberId,v=>{setRecords(v.filter(r=>!r.pending));setRecordsLoaded(true);},fail)];if(serverAiEnabled)offs.push(listenImports(memberId,v=>{setImports(v);setImportsLoaded(true);},fail),listenAiDocument<Analysis>(memberId,'analysis',v=>{setAnalysis(v);setAnalysisLoaded(true);},fail),listenAiDocument<SavedPlan>(memberId,'plans',setPlan,fail));return()=>offs.forEach(f=>f());},[memberId]);
 useEffect(()=>{if(uploadRequest)setUpload(true);},[uploadRequest]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer);},[]);
 useEffect(()=>{analysisScroll.current?.scrollTo({top:0});},[tab]);
 useEffect(()=>{journeyScroll.current?.scrollTo({top:0});},[pane]);
 const defaultedYears=useRef(new Set<string>());
 useEffect(()=>{if(!online||!serverAiEnabled)return;const pending=imports.filter(i=>i.status==='ready'&&!i.year&&i.rows.some(r=>!r.input.date)&&!defaultedYears.current.has(i.id));pending.forEach(i=>defaultedYears.current.add(i.id));void(async()=>{for(const i of pending){try{await callAi({action:'review',memberId,fileId:i.id,revision:i.revision,operation:'year',year:new Date().getFullYear()});}catch(e){setError(aiMessage(e));}}})();},[memberId,imports,online]);
 const alive=useRef(true);useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 useEffect(()=>{
  if(!serverAiEnabled||!filesLoaded||!importsLoaded||!online||!workflowReady)return;
  const missing=files.filter(f=>f.status==='ready'&&!f.originalRemoved&&!f.pending&&!imports.some(i=>i.id===f.id)&&!requestedFiles.current.has(f.id));
  missing.forEach(f=>requestedFiles.current.add(f.id));
  void(async()=>{for(const f of missing){if(!alive.current)return;try{await callAi({action:'read',memberId,fileId:f.id});}catch(e){if(alive.current)setError(aiMessage(e));}}})();
 },[memberId,files,imports,filesLoaded,importsLoaded,online,workflowReady]);

 useEffect(()=>{if(filesLoaded&&selectedFile!=='all'&&!files.some(f=>f.id===selectedFile))setSelectedFile('all');},[files,filesLoaded,selectedFile]);
 useEffect(()=>{if(originalFile&&originalFile!=='all'&&!files.some(f=>f.id===originalFile))setOriginalFile('');},[files,originalFile]);
 const rows=sourceRows(imports,records),pendingRows=rows.filter(r=>r.review==='needs-review'&&!r.alertDismissed),reading=serverAiEnabled?files.filter(f=>!f.originalRemoved&&(f.status==='uploading'||f.status==='ready'&&!imports.some(i=>i.id===f.id)||imports.some(i=>i.id===f.id&&i.status==='processing'))).length:0,report=analysis?.report,processing=records.length>0&&(analysis?.status==='queued'||analysis?.status==='processing');
 const [analysisPeriod,setAnalysisPeriod]=useState('all'),[trendSelection,setTrendSelection]=useState(''),[bodySelection,setBodySelection]=useState(''),[performanceMetric,setPerformanceMetric]=useState<PerformanceMetric>('volume');
 const eligibleRecords=eligibleAnalysisRecords(records,imports);
 const visual=useGoalVisual({memberId,records:eligibleRecords,goal:trainingGoal,results:assessmentResults,notes:sessionNotes,period:analysisPeriod,enabled:!reviewing&&(mode===3||assistantOnly)&&rightPanel==='insights'&&tab==='goal'&&online&&serverAiEnabled&&recordsLoaded&&assessmentLoaded&&importsLoaded&&goalLoaded&&!reading});
 const windowStats=analysisWindow(eligibleRecords,analysisPeriod);
 const showTrend=(key:string,metric?:PerformanceMetric)=>{setTrendSelection(key);if(metric)setPerformanceMetric(metric);setTab('trend');};
 const reviewCount=pendingRows.length+imports.reduce((n,i)=>n+visibleUnparsed(i).length,0);
 const stalled=analysis?.status==='processing'&&!!analysis.startedAt&&now-analysis.startedAt.toMillis()>180000;
 const readingStalled=imports.some(i=>i.status==='processing'&&!!i.startedAt&&now-i.startedAt.toMillis()>180000);
 const showAnalysisLoading=reading>0&&!readingStalled;
 function openRow(id:string){const r=rows.find(r=>r.id===id);if(!r){setError('근거 기록이 변경됐어요. 최신 분석을 기다려주세요.');return;}if(dirty.current&&id!==selectedRow&&!window.confirm('저장하지 않은 수정 내용을 버리고 다른 기록을 볼까요?'))return;if(id!==selectedRow){dirty.current=false;onUnsavedChange?.(planDirty.current);}setTwoViewPanel('work');setSelectedRow(id);setRowOpenRequest(v=>v+1);if(selectedFile!=='all'&&selectedFile!==r.input.sourceHash)setSelectedFile('all');setOriginalFile(r.input.sourceHash||'all');setSourcePage(r.input.sourcePage||1);setJumpRequest(v=>v+1);setSourceHidden(false);setPane('source');}
 async function retry(regenerate=false){if(!serverAiEnabled||busy)return;setBusy(true);try{await callAi({action:'report',memberId,retry:true,regenerate});}catch(e){setError(aiMessage(e));}finally{setBusy(false);}}
 function choosePane(next:Pane){if(next==='plan'&&pane==='plan'&&planDirty.current){setError('수정 중인 수업을 먼저 저장하거나 취소해주세요.');return;}if(next==='plan'&&pane==='plan')setPlanSettingsRequest(v=>v+1);setTwoViewPanel('work');if(next==='analysis'&&pane!=='analysis'){setMode(3);setSourceHidden(false);setRightPanel('insights');}if(next==='plan'){if(pane!=='plan')lastWorkPane.current=pane;setRightPanel('assistant');}else lastWorkPane.current=next;setPane(next);if(next==='source')setSourceHidden(false);}
 const transitionPanel=usePanelTransition();
 function movePlan(right:boolean){transitionPanel(()=>{if(right){setMode(3);setRightPanel('plan');if(pane==='plan')setPane(lastWorkPane.current);}else{setRightPanel('assistant');setPane('plan');}requestAnimationFrame(()=>(right?rightLessonTab:centerLessonTab).current?.focus({preventScroll:true}));});}
 function openAssistant(){if(mode===2){setTwoViewPanel('assistant');setSourceHidden(false);}setRightPanel('assistant');}
 function openInsights(){if(mode===2){setTwoViewPanel('insights');setSourceHidden(false);}setRightPanel('insights');}
 function closeRightPanel(){if(planOnRight)setPane('plan');setTwoViewPanel('work');setMode(2);}
 function original(fileId:string,page:number){setOriginalFile(fileId);setSourcePage(page);setJumpRequest(v=>v+1);setSourceHidden(false);}
 function fromOriginal(fileId:string,page:number){if(assistantOnly){original(fileId,page);return;}if(dirty.current&&!window.confirm('저장하지 않은 수정 내용을 버리고 이동할까요?'))return false;dirty.current=false;onUnsavedChange?.(planDirty.current);setSelectedRow('');if(selectedFile!=='all'&&selectedFile!==fileId)setSelectedFile('all');setOriginalFile(fileId);setSourcePage(page);setRecordJump(v=>v+1);setPane('source');}
 function selectArea(){setSelectionMode(true);}

 const sourceProps={onExplain:(input:import('../lib/workout-records').WorkoutInput)=>{setSelection(null);openAssistant();setAssistantDraft({id:crypto.randomUUID(),fileId:input.sourceHash,fileName:input.sourceName,page:input.sourcePage,question:`${input.sourcePage}쪽 원문 ${input.rawName||input.exerciseName} 기록을 확인하고 싶어요. 현재 입력(아직 저장 전): ${JSON.stringify({exerciseName:input.exerciseName,measurementType:input.measurementType??'repetitions',sets:input.sets})}. 메모: ${input.notes}. 적절한 기록 방식과 단위를 설명하고 필요한 정보를 질문해주세요.`.slice(0,1200)});},sessionNotes:mergeSessionNotes(imports,savedSessionNotes,true),memberId,memberName,online,files,imports,rows,selectedFile,onFile:(id:string)=>{setSelectedFile(id);setOriginalFile(id);setSourcePage(1);setJumpRequest(v=>v+1);},selectedRow,rowOpenRequest,onRow:openRow,onUpload:()=>setUpload(true),onDirty:(v:boolean)=>{dirty.current=v;onUnsavedChange?.(v||planDirty.current);},originalRequest,onOriginal:original,recordFocusFile:originalFile,sourcePage,recordJump,reviewJump};
 const analysisPeriodControls=<div className="pa-common-period"><span>{windowStats.trend[0]?.date??'기록 없음'}{windowStats.to?' — '+windowStats.to:''}</span><div className="ps-filter" aria-label="공통 분석 기간">{[['all','전체'],['28','4주'],['84','12주'],['112','16주']].map(([id,label])=><button key={id} aria-pressed={analysisPeriod===id} onClick={()=>{setAnalysisPeriod(id);openInsights();}}>{label}</button>)}</div></div>;
 const analysisTabs=<AutoHideAnalysisTabs key={tab} tab={tab} scrollRef={analysisScroll} onTab={id=>{openInsights();setTab(id);if(id==='body')setDetailRegion(null);}}/>;
 const insightPanel=(<> <section className="live-pane live-analysis" aria-label="진행 분석"><div className="pane-body analysis-export-content" data-analysis-tab={tab} ref={analysisScroll}>
 {!serverAiEnabled&&<div className="file-error" role="status"><strong>자동 분석 서버 연결을 준비하고 있어요</strong><p>원본 업로드와 열람은 가능해요. 서버 연결이 완료되면 이 화면에서 자동 판독·요약·다음 수업 제안이 시작됩니다.</p></div>}
 {recordsLoaded&&!records.length&&!reading&&reviewCount===0&&<div className="empty-state" role="status"><strong>분석할 운동 기록이 없어요</strong><p>일지를 추가하면 진행 분석을 확인할 수 있어요.</p></div>}
 {showAnalysisLoading&&<div className="analysis-reading-stage" role="status" aria-live="polite"><div className="record-reading-status"><span className="ai-reading-dot" aria-hidden="true"/><strong>{reading?'일지를 읽어 분석하고 있어요':'진행 분석을 갱신하고 있어요'}</strong><p>{reading?'날짜별 운동 기록을 정리하고 있어요.':'저장된 운동 기록을 분석하고 있어요.'}</p><small>완료되면 이 화면에 결과가 표시됩니다.</small></div></div>}
 <div hidden={showAnalysisLoading}>
 {readingStalled&&<div role="status" className="analysis-retry-notice"><p>일지 판독이 지연되고 있어요. 기록 수정에서 상태를 확인해주세요.</p><button onClick={()=>choosePane('source')}>기록 수정 보기</button></div>}

 {pendingRows.length>0&&<button className="live-review-banner" onClick={()=>openRow(pendingRows[0].id)}><Icon name="search"/><span><strong>확인하면 더 정확해지는 항목 {pendingRows.length}개</strong><small>분석은 먼저 볼 수 있어요. 잘못 읽힌 값만 원본 옆에서 수정하세요.</small></span><Icon name="arrow"/></button>}
 {tab==='summary'&&<ProgressSummary sessionNotes={sessionNotes} records={windowStats.records} goal={trainingGoal} onGoal={()=>setGoalOpen(true)} onEvidence={openRow} onOriginalRecord={id=>{const r=rows.find(row=>row.id===id);if(r?.input.sourceHash)original(r.input.sourceHash,r.input.sourcePage);}} onBody={part=>{setDetailRegion(null);setRegionDetails([]);if(part)setBodySelection(part);setTab('body');}}/>}
 {tab==='body'&&detailRegion&&<RegionExerciseList region={detailRegion} records={windowStats.records} onSelect={showTrend}/>}
 {tab==='trend'&&detailRegion&&<button className="region-back-link" onClick={()=>setTab('body')}>← {detailRegion} 운동 목록</button>}
 {tab==='body'&&regionDetails.length>0&&<section className="region-detail-comment"><h3>변화 해석 자세히</h3>{regionDetails.map((d,i)=><p key={i}><strong>{d.title}</strong><br/>{d.text}</p>)}</section>}
 {tab==='body'&&!detailRegion&&<BodyDistribution part={bodySelection} onPart={part=>{setBodySelection(part);setRegionDetails([]);}} records={windowStats.records} goal={trainingGoal} onEvidence={openRow} onTrend={showTrend}/>}
 {tab==='trend'&&<PerformanceTrend requested={performanceMetric} onMetric={setPerformanceMetric} records={windowStats.records} selection={trendSelection} onSelect={setTrendSelection} goal={trainingGoal} onEvidence={openRow}/>}
 {tab==='goal'&&(goalLoaded?<GoalEvaluation from={analysisPeriod==='all'?'':windowStats.from} to={analysisPeriod==='all'?'9999-12-31':windowStats.to} memberId={memberId} online={online} allRecords={eligibleRecords} goal={trainingGoal} onGoal={()=>setGoalOpen(true)} onTrend={showTrend} period={analysisPeriod} results={assessmentResults} notes={sessionNotes} {...visual} onRetry={visual.refresh} onSummary={()=>setTab('summary')} onBody={part=>{setDetailRegion(null);setRegionDetails([]);setBodySelection(part);setTab('body');}} onOriginal={id=>{const r=rows.find(row=>row.id===id);if(r?.input.sourceHash)original(r.input.sourceHash,r.input.sourcePage);}}/>:<div className="ge-empty" role="status"><h3>{goalError?'목표 조회 실패':'목표 불러오는 중'}</h3><p>{goalError||'저장된 목표와 평가 기준 확인 중'}</p><button onClick={()=>setGoalRetry(v=>v+1)}>다시 불러오기</button></div>)}
 {goalError&&tab!=='goal'&&<p className="file-error" role="alert">목표 정보를 불러오지 못했어요. {goalError}</p>}

 <details className="analysis-calculation-details"><summary>집계 기준</summary><dl className="analysis-basis-list"><div><dt>수업</dt><dd>같은 날짜는 한 수업으로 묶음.</dd></div><div><dt>평균</dt><dd>평균 세트: 중량·횟수 기록 {windowStats.strengthDays}일. 평균 볼륨: 중량 기록 {windowStats.weightedDays}일 기준. 유산소 {windowStats.cardio}구간 별도 집계.</dd></div><div><dt>볼륨</dt><dd>중량 × 반복수의 합계. L/R 한 쌍은 1세트, 반복수는 좌우 합계. 맨몸·중량 미상 {windowStats.excludedVolume}세트 제외.</dd></div><div><dt>부위 비중</dt><dd>주동근 세트 기준. 보조근 중복 합산 없음. 전신·미분류는 부위 비중에서, 코어는 상하체 비율에서 제외.</dd></div><div><dt>반영 기록</dt><dd>잠정 기록 {windowStats.provisional}개 포함 · 형식 확인 필요 {windowStats.excludedRecords}개 제외. 확인 필요·제외로 표시한 기록 미반영.</dd></div><div><dt>비교 범위</dt><dd>계획 범위: 트레이너 설정 기준. 관찰 범위: 기록의 중간 50%, 적정 기준과 무관. 저장된 AI 의견: 리포트 생성 시점의 범위 적용.</dd></div>{trainingGoal?.plan.reason&&<div><dt>설정 이유</dt><dd>{trainingGoal.plan.reason}</dd></div>}</dl></details>{error&&<p className="file-error" role="alert">{error}</p>}
 </div></div></section></>);
 return <div onPointerDownCapture={()=>{entryTouched.current=true;}} onKeyDownCapture={()=>{entryTouched.current=true;}} className={'live-workspace review-workspace '+(mode===3?'with-assistant ':'')+(assistantOnly?'source-assistant-view ':'')+(sourceHidden?'source-collapsed ':'')+'working-'+pane} aria-label="업로드 기반 분석 작업실">

 <header className="review-titlebar"><button className="review-back" onClick={onBack} aria-label="회원 목록으로 돌아가기" title="회원 목록으로 돌아가기"><Icon name="back" size={18}/><span>돌아가기</span></button><h1 title={`${memberName} · 운동 기록`}>{memberName} · 운동 기록</h1><div className="review-title-actions"><button aria-label="훈련 목표 설정" className="review-goal-button" onClick={()=>setGoalOpen(true)}><Icon name="target" size={16}/> 훈련 목표</button><div className="segmented review-view-mode" aria-label="화면 구성"><button aria-pressed={mode===2} className={mode===2?'selected':''} onClick={closeRightPanel}>2뷰</button><button aria-pressed={mode===3} className={mode===3?'selected':''} title="원본 · 회원 변화 · 분석 자료와 AI 도우미" onClick={()=>{setMode(3);setSourceHidden(false);}}>3뷰</button></div></div></header>

 <WorkspaceToast message={uploadNotice} onClose={()=>setUploadNotice('')}/>
 <ResizableReviewColumns mode={mode} sourceHidden={sourceHidden} assistantOnly={assistantOnly}>
 <section className="review-original" aria-label="원본 일지" hidden={sourceHidden}>
  {files.length?<ContinuousSourceViewer onUpload={()=>setUpload(true)} onCollapse={()=>{setSourceHidden(true);setSelectionMode(false);}} onToggleThumbnails={()=>setThumbnailsOpen(v=>!v)} onNotice={setUploadNotice} online={online&&serverAiEnabled} beforeDelete={()=>{if(dirty.current||planDirty.current){setUploadNotice("작성 중인 내용을 먼저 저장하거나 취소해주세요.");return false;}return true;}} onDeleteBusy={v=>onUnsavedChange?.(v||dirty.current||planDirty.current)} memberId={memberId} files={files} selectedFile={originalFile||selectedFile} sourcePage={sourcePage} jumpRequest={jumpRequest} thumbnailsOpen={thumbnailsOpen} onNavigate={(id,page)=>{if(fromOriginal(id,page)===false)return false;original(id,page);return true;}} onPageClick={fromOriginal}/>:<div className="empty-state"><Icon name="upload" size={30}/><h3>일지를 올려주세요</h3><p>PDF·PNG·JPEG를 한 화면에서 볼 수 있어요.</p><button className="primary" onClick={()=>setUpload(true)}>일지 추가</button></div>}
 </section>
 <div className="review-work" hidden={assistantOnly}><div className="review-work-heading">{sourceHidden&&<button className="review-show-original" onClick={()=>setSourceHidden(false)} aria-label="원본 펼치기" title="원본 펼치기"><Icon name="forward" size={17}/></button>}<nav className="review-tabs" aria-label="작업 화면">{((reviewing?[['source','기록 검토·수정']]:[['source','기록 확인'],['analysis','회원 변화'],['direction','수업 제안'],['plan','수업 계획'],['previous','이전 수업']]) as [Pane,string][]).map(([id,label])=><div className="review-tab-item" key={id} data-active={pane===id}><button ref={id==='plan'?centerLessonTab:undefined} aria-current={pane===id?'page':undefined} onClick={()=>choosePane(id)}>{label}</button>{id==='source'&&reviewCount>0&&<button className="review-pending-count" aria-label={`수정 필요한 기록 ${reviewCount}개로 이동`} title="수정 필요한 항목으로 이동" onClick={()=>{setPane('source');setSourceHidden(false);setReviewJump(v=>v+1);}}>{reviewCount}</button>}</div>)}</nav>{mode!==3&&<div className="review-panel-shortcuts"><button className="review-open-assistant" onClick={openInsights} aria-label="분석 자료 열기"><span>분석 자료</span></button><button className="review-open-assistant" onClick={openAssistant} aria-label="AI 도우미 열기"><span>AI 도우미</span></button></div>}<div className="workspace-menu-host"><div ref={setRecordToolsHost} hidden={pane!=='source'}/>{pane!=='source'&&<AnalysisTools key={pane} workspaceMenu hideRegenerate contentLabel={{source:'판독 기록',analysis:'회원 변화',direction:'수업 제안',plan:'수업 계획',previous:'이전 수업'}[pane]} kind={pane==='analysis'?'analysis':'lesson'} memberId={memberId} contentRef={pane==='previous'?previousContent:journeyScroll} online={online} busy={false} canRegenerate={false} onRegenerate={async()=>{}}/>}</div></div>
 <div className="review-content" hidden={pane!=='source'}>{checkingEntry?<div className="empty-state" role="status">저장된 분석을 불러오고 있어요…</div>:<><AnalysisSource {...sourceProps} recordsOnly toolsHost={recordToolsHost}/><div className="journey-review-footer">{entryError&&<p role="alert">저장된 분석을 불러오지 못했어요. {entryError} <button onClick={()=>{entryTouched.current=false;setEntryChecked(false);setEntryRetry(v=>v+1);}}>다시 불러오기</button></p>}<p>{reviewCount?`미확인 ${reviewCount}개는 남겨두고, 확인 가능한 기록으로 분석할 수 있어요.`:"날짜·수치·운동명을 확인한 뒤 분석으로 이어가세요."}</p><button className="primary" disabled={!!reading||!eligibleRecords.length||!workflowReady} onClick={()=>{if(dirty.current){setError("수정 중인 기록을 먼저 저장하거나 취소해주세요.");return;}setAnalysisRequested(true);setInitialContext(null);setReviewing(false);setPane("analysis");setTab("summary");setSourceHidden(false);setMode(3);setRightPanel("insights");}}>확인한 기록으로 분석하기 →</button>{!workflowReady&&<button onClick={()=>setWorkflowRetry(v=>v+1)}>분석 연결 다시 확인</button>}</div></>}</div>
 <div ref={previousContent} className="review-content" hidden={pane!=='previous'}><PreviousLessons key={memberId} rows={rows} notes={mergeSessionNotes(imports,savedSessionNotes,true)} today={new Date(now+9*3600000).toISOString().slice(0,10)} loaded={recordsLoaded&&(!serverAiEnabled||importsLoaded)} onEdit={openRow} onNext={()=>choosePane('plan')}/></div>
 <div ref={journeyScroll} className="review-content journey-scroll" tabIndex={0} role="region" aria-label="회원 변화와 수업 계획" hidden={reviewing||!['analysis','direction','plan'].includes(pane)}>{!reviewing&&<CoachingJourney initialContext={initialContext} allowAutomaticAnalysis={analysisRequested} planSettingsRequest={planSettingsRequest} onDirty={v=>{planDirty.current=v;onUnsavedChange?.(v||dirty.current);}} recordParts={Object.fromEntries(eligibleRecords.map(r=>[r.id,r.bodyPart]))} onRegionDetails={(region,details)=>{setDetailRegion(region);setRegionDetails(details);analysisScroll.current?.scrollTo({top:0});setMode(3);setRightPanel('insights');setAnalysisPeriod('all');setTab('body');setBodySelection(region==='상체'?'등':region);}} legacyPlan={plan} key={memberId} memberId={memberId} online={online&&serverAiEnabled&&workflowReady&&!reading} revision={workflowRevision} stage={pane==='direction'?'direction':pane==='plan'?'plan':'analysis'} onStage={choosePane} onOriginal={id=>{const r=rows.find(v=>v.id===id);if(r)original(r.input.sourceHash,r.input.sourcePage);}} onGoal={()=>setGoalOpen(true)} onDetails={()=>{setMode(3);setRightPanel('insights');}} decisionsVersion={decisionsVersion} onDiscuss={(target,question)=>{setSelection(null);setAssistantDraft({id:crypto.randomUUID(),fileId:'',fileName:'',page:1,question,discussion:target});openAssistant();}} onAsk={(question,recordId,autoSend=false)=>{const r=rows.find(v=>v.id===recordId);setSelection(null);setAssistantDraft({id:crypto.randomUUID(),fileId:r?.input.sourceHash??'',fileName:r?.input.sourceName??'',page:r?.input.sourcePage??1,question,autoSend});openAssistant();}} onTrendRecord={(id,metric)=>{const group=exerciseGroups(eligibleRecords).find(g=>g.records.some(r=>r.id===id));if(group){setTrendSelection(group.key);setPerformanceMetric(metric as PerformanceMetric);setAnalysisPeriod('all');setTab('trend');setRightPanel('insights');setMode(3);}}}/>}</div>

 </div>
 <div className="review-assistant journey-side" hidden={mode!==3&&!assistantOnly}><div className="right-panel-tabs">{assistantOnly&&<button className="assistant-back-work" onClick={closeRightPanel}><Icon name="back" size={16}/> 작업 화면</button>}{assistantOnly&&sourceHidden&&<button onClick={()=>setSourceHidden(false)} aria-label="원본 펼치기"><Icon name="forward" size={17}/></button>}<AnalysisControlsMenu active={rightPanel==='insights'} onActivate={openInsights}>{analysisTabs}{analysisPeriodControls}</AnalysisControlsMenu><button aria-pressed={rightPanel==='assistant'} onClick={openAssistant}>AI 도우미</button><button aria-label="우측 패널 닫기" onClick={closeRightPanel}><Icon name="close" size={16}/></button></div><div className="journey-side-content" hidden={rightPanel!=='insights'}>{insightPanel}</div><div className="journey-side-content" hidden={rightPanel!=='assistant'}><AssistantChat memberName={memberName} hideHeading referenceRecords={rows.map(r=>({id:r.id,date:r.input.date,exerciseName:r.input.exerciseName,sourcePage:r.input.sourcePage}))} key={memberId} draft={assistantDraft} onDraftConsumed={id=>setAssistantDraft(current=>current?.id===id?null:current)} memberId={memberId} online={online} selection={selection} onRestoreSelection={setSelection} onClearSelection={()=>setSelection(null)} onSelectArea={selectArea} onClose={closeRightPanel} onEvidence={openRow} onOriginal={original} onDecision={()=>setDecisionsVersion(v=>v+1)}/></div></div></ResizableReviewColumns>

 {selectionMode&&<ScreenCapture onCancel={()=>setSelectionMode(false)} onCapture={v=>{setSelection(v);setSelectionMode(false);openAssistant();}}/>}
 {goalOpen&&!goalLoaded&&<GoalLoadingDialog error={goalError} onRetry={()=>setGoalRetry(v=>v+1)} onClose={()=>setGoalOpen(false)}/>}
 {goalOpen&&goalLoaded&&<TrainingGoalDialog memberName={memberName} memberId={memberId} initial={trainingGoal} legacyGoal={goal} online={online} onClose={()=>setGoalOpen(false)} onSaved={upload=>{setGoalOpen(false);if(upload&&!records.length&&!files.length)setUpload(true);}}/>}
 {upload&&<UploadDialog onClose={()=>setUpload(false)}><MemberFiles memberId={memberId} memberName={memberName} online={online} onUploaded={(id,result)=>{setUploadNotice(uploadSummaryText(result));setSelectedFile('all');setOriginalFile(id);setSelectedRow('');setSourcePage(1);setSourceHidden(false);setJumpRequest(v=>v+1);setOriginalRequest(v=>v+1);setAnalysisRequested(false);setInitialContext(null);setReviewing(true);setPane('source');setTab('summary');setUpload(false);}}/></UploadDialog>}
 </div>;
}
function UploadDialog({onClose,children}:{onClose:()=>void;children:React.ReactNode}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const old=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>old?.focus();},[]);return <dialog ref={ref} className="live-upload-dialog" onCancel={e=>{e.preventDefault();onClose();}}><div className="dialog-title"><div><h2>일지를 올리면 기록부터 확인해요</h2><p>읽은 결과는 저장하므로 다시 열 때 재판독하지 않아요.</p></div><button className="icon-button" aria-label="업로드 닫기" onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>;}

function GoalLoadingDialog({error,onRetry,onClose}:{error:string;onRetry:()=>void;onClose:()=>void}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const previous=document.activeElement as HTMLElement|null;ref.current?.showModal();return()=>{if(previous?.isConnected)previous.focus();};},[]);return <dialog ref={ref} className="goal-loading-dialog" aria-labelledby="goal-loading-title" onCancel={e=>{e.preventDefault();onClose();}}><header><h2 id="goal-loading-title">훈련 목표</h2><button onClick={onClose} aria-label="목표 설정 닫기"><Icon name="close" size={18}/></button></header><p role={error?'alert':'status'}>{error||'저장된 목표와 평가 기준 확인 중…'}</p><button onClick={onRetry}>다시 불러오기</button></dialog>;}
