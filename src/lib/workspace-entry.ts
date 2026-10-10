// Only persisted results open the workflow; opening a member never authorizes AI generation.
export function savedWorkspacePane(context:{status:string;report:unknown;savedPlan?:unknown;latestProposal?:unknown}):'source'|'analysis'|'plan'{
 if(context.status==='ready'&&context.report)return 'analysis';
 if(context.savedPlan||context.latestProposal)return 'plan';
 return 'source';
}
