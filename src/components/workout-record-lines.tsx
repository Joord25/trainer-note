"use client";
import type {WorkoutRecord} from '../lib/workout-records';
import {formatWorkoutSet} from '../lib/workout-measurements';
import {displayWorkoutNotes} from '../lib/progress-analysis';
export function RecordLines({records,onEvidence,showNotes=false}:{records:WorkoutRecord[];onEvidence:(id:string)=>void;showNotes?:boolean}){return <div className="pa-records">{records.map(r=><div key={r.id}><button className="pa-record-date" onClick={()=>onEvidence(r.id)}>{r.date} ↗</button><span>{r.sets.map((s,i)=><span className="pa-set" key={i}>{i+1}. {formatWorkoutSet(r,s)}</span>)}{showNotes&&displayWorkoutNotes(r.notes)&&<small className="pa-note">{displayWorkoutNotes(r.notes)}</small>}</span></div>)}</div>;}
