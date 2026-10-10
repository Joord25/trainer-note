import type {ReactNode} from 'react';

/** Shared disclosure typography for the report, proposal, plan and history tabs. */
export function RecordSummary({label,children}:{label:ReactNode;children:ReactNode}){
 return <details className="journey-record-summary"><summary>{label}</summary><div className="record-summary-body">{children}</div></details>;
}
