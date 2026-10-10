import type {ReactNode} from 'react';

/** Shared title, body and section spacing; emphasis is supplied by each screen. */
export function ReportSection({title,heading:Heading='h2',action,children,className=''}:{title:string;heading?:'h2'|'h3';action?:ReactNode;children:ReactNode;className?:string}){
 return <article className={`report-section ${className}`}>
  <header className="report-section-heading goal-review-heading"><Heading>{title}</Heading>{action}</header>
  {children}
 </article>;
}
