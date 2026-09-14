import type {WorkoutRecord} from '../lib/workout-records';
import {blankTrainingGoal,type SavedTrainingGoal} from '../lib/training-goals';
import {sessions} from './demo-data';

// Synthetic fixtures only. Add reviewed, anonymized formats here after each format test.
export type DemoScenario={id:string;title:string;description:string;records:WorkoutRecord[];goal:SavedTrainingGoal};
const dates=['2026-06-09','2026-06-22','2026-07-06','2026-07-20','2026-08-10'];
const names:Record<string,[string,string]>={'프런트 스쿼트':['프런트 스쿼트','하체'],'BB front sq':['프런트 스쿼트','하체'],'BB sq':['백 스쿼트','하체'],'시티드 로우':['시티드 로우','등'],'랫 풀다운':['랫 풀다운','등'],'체스트 프레스':['체스트 프레스','가슴'],'숄더 프레스':['숄더 프레스','어깨'],'크런치':['크런치','코어']};
const records:WorkoutRecord[]=sessions.flatMap((session,day)=>session.rows.map(([rawName,loads,repetitions],row)=>{
 const [exerciseName,bodyPart]=names[rawName],weights=loads.split(' / ');
 return {id:`demo-${day}-${row}`,revision:1,pending:false,origin:'manual',status:'confirmed',measurementType:'repetitions',date:dates[day],rawName,exerciseName,bodyPart,loadType:weights[0]==='—'?'bodyweight':'weighted',sets:repetitions.split(' / ').map((reps,i)=>({kg:(weights[i]??weights.at(-1))==='—'?null:Number(weights[i]??weights.at(-1)),reps:Number(reps)})),sourceName:`예시 운동일지 ${dates[day]}`,sourceHash:String(day+1).repeat(64),sourcePage:1,notes:'',trainerNote:day===4&&row===0?'백 스쿼트로 변경. 프런트 스쿼트와 중량을 직접 비교하지 않음.':''};
}));
export const demoScenarios:DemoScenario[]=[{id:'strength-log',title:'예시 회원 A',description:'중량·횟수 운동일지 · 5회 수업',records,goal:{...blankTrainingGoal(),revision:1,route:'existing',primary:'근력',secondary:['근비대'],detail:'같은 운동·기구·수행 조건에서 중량과 반복 수행 능력 확인',startMode:'first',startDate:'',metrics:['strength','observation'],protocol:'프런트 스쿼트와 백 스쿼트는 별도 운동으로 비교',observation:'운동 변경과 컨디션을 함께 확인'}}];
