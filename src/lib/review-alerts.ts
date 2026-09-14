type ReviewRow = {id:string;issues:string[];review:string};
type Unparsed = {page:number;text:string;reason:string};
type ReviewImport = {rows:ReviewRow[];unparsed:Unparsed[];dismissedReviewAlerts?:string[]};
// Content-based keys keep dismissal separate from record confirmation and array positions.
export const rowAlertKey=(row:ReviewRow)=>JSON.stringify(['row',row.id,[...new Set(row.issues)].sort()]);
export const unparsedAlertKey=(raw:Unparsed)=>JSON.stringify(['unparsed',raw.page,raw.text,raw.reason]);
export const isReviewAlertVisible=(data:Pick<ReviewImport,'dismissedReviewAlerts'>|undefined,key:string)=>!data?.dismissedReviewAlerts?.includes(key);
export const visibleUnparsed=(data?:ReviewImport)=>data?.unparsed.map((value,index)=>({value,index})).filter(({value})=>isReviewAlertVisible(data,unparsedAlertKey(value)))??[];
export const currentReviewAlertKeys=(data:ReviewImport)=>[...data.rows.filter(r=>r.review==='needs-review').map(rowAlertKey),...data.unparsed.map(unparsedAlertKey)];
