export function orderedMemberIds(ids:string[],saved:string[]){const present=new Set(ids);return [...new Set([...saved.filter(id=>present.has(id)),...ids])];}
export function moveMemberId(ids:string[],source:string,target:string){const from=ids.indexOf(source),to=ids.indexOf(target);if(from<0||to<0||from===to)return ids;const next=[...ids];next.splice(from,1);next.splice(to,0,source);return next;}
