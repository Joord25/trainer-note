export type MemberStatus = 'active' | 'hidden' | 'ended';
export type MemberFolder = MemberStatus | 'all';
export const memberFolderLabels:Record<MemberFolder,string> = {active:'관리 중',hidden:'숨긴 회원',ended:'계약 종료',all:'전체'};
// Older member documents have no status and remain in the active list.
export function memberStatus(value:unknown):MemberStatus {return value==='hidden'||value==='ended'?value:'active';}
export function membersInFolder<T extends {status?:MemberStatus}>(members:T[],folder:MemberFolder):T[]{return members.filter(member=>folder==='all'||memberStatus(member.status)===folder);}
