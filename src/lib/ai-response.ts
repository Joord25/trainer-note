// Workflow status responses may contain a stored job error alongside usable context.
export function unwrapAiResponse<T extends {error?:string;status?:string;inputKey?:string;evidence?:unknown;proposalId?:string}>(action:unknown,value:T):T{
 const contextStatus=['workflowContext','analyzeChanges'].includes(String(action))&&value?.status==='error'&&typeof value.inputKey==='string'&&Array.isArray(value.evidence);
 const cycleStatus=action==='cycleStatus'&&value?.status==='error'&&typeof value.proposalId==='string';
 if(value?.error&&!contextStatus&&!cycleStatus)throw Error(value.error);
 return value;
}
