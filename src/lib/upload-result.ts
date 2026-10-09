import type {ExistingSource} from './source-file';
export type UploadSummary = {uploaded:number;failed:number;duplicates:number};
export type UploadIssue = {name:string;message:string;existing?:ExistingSource};
export type UploadResult = UploadSummary & {lastId:string;issues:UploadIssue[]};
export function uploadSummaryText(result:UploadSummary):string {
  return [result.uploaded?`${result.uploaded}개 업로드 완료`:'',result.duplicates?`${result.duplicates}개 중복 · 추가 안 함`:'',result.failed?`${result.failed}개 업로드 실패`:''].filter(Boolean).join(' · ');
}
