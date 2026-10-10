"use client";
import {ReportSection} from './report-section';
import type {ReactNode} from 'react';
import type {GoalReview} from './direction-review';
import {CoachingResearchNote,ResearchText} from './coaching-research-note';
import {toFriendlyExplanation} from '../lib/explanation-tone';

export function ReportSummary({text}:{text:string}){
 const value=toFriendlyExplanation(text),phrase='대근육군 저항운동과 유산소 세션을 병행',index=value.indexOf(phrase);
 return <p className="report-summary">{index<0?<mark className="report-key-point">{value}</mark>:<>{value.slice(0,index)}<mark className="report-key-point">{phrase}</mark>{value.slice(index+phrase.length)}</>}</p>;
}

/** Both report tabs share the same reading hierarchy and emphasis. */
export function CoachingReportOverview({title,headline,review,heading='h3',headingAction}:{title:string;headline?:string;review:GoalReview;heading?:'h2'|'h3';headingAction?:ReactNode}){
 return <ReportSection title={title} heading={heading} action={headingAction} className="region-change-card coaching-report-overview">
  {headline&&<ReportSummary text={headline}/>}
  <p><ResearchText text={review.summary} research={review.publicResearch}/></p>
  <p><ResearchText text={review.reason} research={review.publicResearch}/></p>
  <p><strong>다음 수업에서는 </strong><mark className="report-key-point"><ResearchText text={review.nextStep.replace(/^다음 수업에서는\s*/,'')} research={review.publicResearch}/></mark></p>
  <CoachingResearchNote research={review.publicResearch}/>
 </ReportSection>;
}
