"use client";
import type {ButtonHTMLAttributes} from 'react';
import {Icon} from './icons';

export function AiReanalysisButton({busy=false,...props}:Omit<ButtonHTMLAttributes<HTMLButtonElement>,'children'|'className'> & {busy?:boolean}) {
 return <button {...props} type="button" className="ai-reanalysis-button"><Icon name="refresh" size={15}/>{busy?'분석 중…':'AI 재분석'}</button>;
}
