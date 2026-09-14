import type {WorkoutInput} from './workout-records';
import {formatWorkoutSet} from './workout-measurements';
type ExportGroup={name:string;rows:{input:WorkoutInput;review:string}[];unparsed:{page:number;text:string;reason:string}[]};
export function recordExport(memberName:string,groups:ExportGroup[]):HTMLElement{
 const root=document.createElement('div');root.className='record-export-document';
 const add=(parent:HTMLElement,tag:string,text:string)=>{const el=document.createElement(tag);el.textContent=text;parent.append(el);return el;};
 add(root,'h1',`${memberName} · 판독 기록`);
 for(const group of groups){const section=document.createElement('section');root.append(section);add(section,'h2',group.name);
  for(const {input,review} of group.rows){const article=document.createElement('article');section.append(article);add(article,'h3',input.exerciseName||input.rawName||'운동명 확인 필요');add(article,'p',`${input.date||'날짜 확인 필요'} · ${input.sourcePage}쪽 · ${input.bodyPart}${review==='needs-review'?' · 확인 필요':''}`);
   const list=document.createElement('ol');article.append(list);input.sets.forEach(set=>add(list,'li',formatWorkoutSet(input,set)));if(input.trainerNote)add(article,'p','수업 메모: '+input.trainerNote);if(input.notes)add(article,'p',input.notes);
  }
  if(group.unparsed.length){add(section,'h3','확인할 내용');group.unparsed.forEach(v=>add(section,'p',`${v.page}쪽 · ${v.text} — ${v.reason}`));}
 }
 return root;
}
