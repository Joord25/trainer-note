import {validateGoalCoaching,type GoalCoaching} from './goal-coaching';
import {validateTrainingAssessment,type TrainingAssessment} from './training-assessment';
import type {WorkoutRecord} from './workout-records';
import {isCardioWorkout} from './cardio-distribution';
import {validMeasurement,measurementType} from './workout-measurements';
export const TRAINING_GOALS=['좌우 균형 발전','근비대','근력','심폐·체력','다이어트(체지방 감소)','직접 설정'] as const;
export const TRAINING_PARTS=['가슴','등','어깨','이두','삼두','하체','코어'] as const;
export const TRAINING_METRICS=[{id:'side',title:'좌우 균형 변화',description:'같은 운동·중량·가동 범위에서 L/R 횟수와 동작의 질을 함께 확인해요.'},{id:'strength',title:'중량·횟수·세트 추이',description:'같은 운동·기구의 수행을 비교해요. 볼륨 증가만으로 근육 성장을 확정하지 않아요.'},{id:'cardio',title:'거리·시간과 수행 반응',description:'같은 종목·거리·저항·휴식 조건에서 비교하고 느낀 강도를 함께 기록해요.'},{id:'composition',title:'인바디·체성분 측정',description:'같은 기기와 유사한 측정 조건에서 체중·체지방률·체지방량·골격근량을 함께 살펴봐요.'},{id:'observation',title:'트레이너 관찰',description:'같은 평가 동작에서 자세 유지, 피로와 회원 반응을 확인해요.'}];
export type NumericRange={min:number;max:number};
export type TrainingGoal={version:1;route:'new'|'existing';primary:string;secondary:string[];detail:string;initialState?:string;assessment?:TrainingAssessment|null;coaching?:GoalCoaching|null;startMode:'first'|'date'|'unknown';startDate:string;reviewAfter:number;metrics:string[];observation:string;protocol:string;distribution:{mode:'none'|'split'|'focus'|'percent';upper:number;parts:string[];shares:Record<string,number>};plan:{sets:NumericRange|null;volume:NumericRange|null;from:string;to:string;reason:string;confirmed:boolean}};
export type SavedTrainingGoal=TrainingGoal&{revision:number};
export const todayKorea=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
export function blankTrainingGoal():TrainingGoal{return {version:1,route:'new',primary:'',secondary:[],detail:'',initialState:'',startMode:'date',startDate:todayKorea(),reviewAfter:4,metrics:[],observation:'',protocol:'',distribution:{mode:'none',upper:50,parts:[],shares:{}},plan:{sets:null,volume:null,from:'',to:'',reason:'',confirmed:false}};}
export function trainingGoalTitle(goal:Pick<TrainingGoal,'primary'|'detail'>){return goal.primary==='직접 설정'?goal.detail.trim()||'직접 설정':goal.primary;}
/** Old auto-filled guidance is not a trainer-authored evaluation condition. */
export function trainingGoalNotes(goal:Pick<TrainingGoal,'observation'|'protocol'>){
 const observation=goal.observation.trim(),protocol=goal.protocol.trim();
 const guidance=new Set(TRAINING_METRICS.map(m=>m.description));
 return {observation:observation==='동작의 질, 피로와 회원 반응 확인'?'':goal.observation,protocol:protocol&&protocol.split('\n').every(line=>guidance.has(line.trim()))?'':goal.protocol};
}
export function goalMetricIds(primary:string,secondary:string[]=[]){const map:Record<string,string[]>={'좌우 균형 발전':['side','observation'],'근비대':['strength','composition'],'근력':['strength','observation'],'심폐·체력':['cardio','observation'],'다이어트(체지방 감소)':['composition','strength'],'직접 설정':['observation']};return [...new Set([primary,...secondary].flatMap(g=>map[g]??[]))];}
export function validDate(v:unknown):v is string{return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&v>='1900-01-01'&&v<='2100-12-31'&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}
export function validateTrainingGoal(input:unknown):TrainingGoal{
 const v=input as TrainingGoal;const fail=(message:string):never=>{throw Error(message);};
 if(!v||v.version!==1||!['new','existing'].includes(v.route)||!(TRAINING_GOALS as readonly string[]).includes(v.primary))fail('회원 상황과 우선 목표를 선택해주세요.');
 const text=(x:unknown,max:number)=>typeof x==='string'&&x.length<=max;
 if(v.primary==='직접 설정'&&(typeof v.detail!=='string'||!v.detail.trim()))fail('직접 입력할 목표를 작성해주세요.');
 if(v.initialState!==undefined&&!text(v.initialState,500))fail('초기 상태는 500자 이내로 작성해주세요.');
 if(!text(v.detail,300)||!Array.isArray(v.secondary)||v.secondary.length>5||new Set(v.secondary).size!==v.secondary.length||v.secondary.some(g=>g===v.primary||!(TRAINING_GOALS as readonly string[]).includes(g)))fail('목표의 상세 내용을 확인해주세요.');
 if(!['first','date','unknown'].includes(v.startMode)||!text(v.startDate,10)||v.startMode==='date'&&!validDate(v.startDate)||v.route==='new'&&v.startMode!=='date'||!Number.isInteger(v.reviewAfter)||v.reviewAfter<2||v.reviewAfter>40)fail('목표 적용일과 재평가 회차를 확인해주세요.');
 if(!Array.isArray(v.metrics)||!v.metrics.length||v.metrics.length>TRAINING_METRICS.length||new Set(v.metrics).size!==v.metrics.length||v.metrics.some(id=>!TRAINING_METRICS.some(m=>m.id===id))||!text(v.observation,500)||!text(v.protocol,2000))fail('평가 지표와 체크 항목·평가 조건을 확인해주세요.');
 const d=v.distribution;if(!d||!['none','split','focus','percent'].includes(d.mode)||!Number.isInteger(d.upper)||d.upper<0||d.upper>100||!Array.isArray(d.parts)||d.parts.length>7||new Set(d.parts).size!==d.parts.length||d.parts.some(p=>!(TRAINING_PARTS as readonly string[]).includes(p))||!d.shares||typeof d.shares!=='object'||Object.keys(d.shares).some(p=>!(TRAINING_PARTS as readonly string[]).includes(p)||!Number.isInteger(d.shares[p])||d.shares[p]<0||d.shares[p]>100))fail('훈련 부위와 비중을 확인해주세요.');
 if(['focus','percent'].includes(d.mode)&&!d.parts.length||d.mode==='percent'&&(d.parts.some(p=>!d.shares[p])||d.parts.reduce((n,p)=>n+d.shares[p],0)!==100))fail('부위별 비율은 합계 100%로 맞춰주세요.');
 const p=v.plan;if(!p||!text(p.from,10)||!text(p.to,10)||!text(p.reason,500)||typeof p.confirmed!=='boolean')fail('계획 범위를 확인해주세요.');
 for(const [id,max] of [['sets',1000],['volume',1e9]] as const){const r=p[id];if(r!==null&&(!r||!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.min<0||r.min>r.max||r.max>max||id==='sets'&&(!Number.isInteger(r.min)||!Number.isInteger(r.max))))fail('계획 범위의 최솟값·최댓값을 확인해주세요.');}
 if((p.sets||p.volume)&&(!p.confirmed||!p.reason.trim()||!validDate(p.from)||!validDate(p.to)||p.from>p.to||v.startMode==='unknown'||v.startMode==='date'&&p.from<v.startDate))fail('계획 범위의 적용 기간·이유와 트레이너 확인이 필요해요.');
 return {coaching:validateGoalCoaching(v.coaching),assessment:validateTrainingAssessment(v.assessment),version:1,route:v.route,primary:v.primary,secondary:[...v.secondary],detail:v.detail.trim(),initialState:(v.initialState??'').trim(),startMode:v.startMode,startDate:v.startMode==='date'?v.startDate:'',reviewAfter:v.reviewAfter,metrics:[...v.metrics],observation:v.observation.trim(),protocol:v.protocol.trim(),distribution:{mode:d.mode,upper:d.upper,parts:[...d.parts],shares:Object.fromEntries(d.parts.filter(p=>d.shares[p]!==undefined).map(p=>[p,d.shares[p]]))},plan:{sets:p.sets?{min:p.sets.min,max:p.sets.max}:null,volume:p.volume?{min:p.volume.min,max:p.volume.max}:null,from:p.from,to:p.to,reason:p.reason.trim(),confirmed:p.confirmed}};
}
export type ProgressDay={date:string;sets:number;volume:number|null;weightedSets:number;excludedVolume:number;cardio:number};
export function progressStats(records:WorkoutRecord[],from='',to='9999-12-31'){
 const days=new Map<string,ProgressDay>(),parts:Record<string,number>={};let excludedRecords=0,provisional=0;
 const valid=records.filter(r=>{if(r.pending||!validDate(r.date)||r.date<from||r.date>to)return false;if(!validMeasurement(r)){excludedRecords++;return false;}return true;});
 for(const r of valid){if(r.status==='provisional')provisional++;const day=days.get(r.date)??{date:r.date,sets:0,volume:null,weightedSets:0,excludedVolume:0,cardio:0};if(isCardioWorkout(r))day.cardio+=r.sets.length;else if(measurementType(r)==='repetitions'){day.sets+=r.sets.length;parts[r.bodyPart]=(parts[r.bodyPart]??0)+r.sets.length;for(const s of r.sets){if(r.loadType==='weighted'&&s.kg!==null){day.volume=(day.volume??0)+s.kg*s.reps;day.weightedSets++;}else day.excludedVolume++;}}days.set(r.date,day);}
 const trend=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)),strengthDays=trend.filter(d=>d.sets>0),weightedDays=trend.filter(d=>d.volume!==null),sets=trend.reduce((n,d)=>n+d.sets,0),volume=trend.reduce((n,d)=>n+(d.volume??0),0);
 return {trend,parts,sets,volume,days:trend.length,strengthDays:strengthDays.length,weightedDays:weightedDays.length,averageSets:strengthDays.length?sets/strengthDays.length:null,averageVolume:weightedDays.length?volume/weightedDays.length:null,excludedVolume:trend.reduce((n,d)=>n+d.excludedVolume,0),cardio:trend.reduce((n,d)=>n+d.cardio,0),excludedRecords,provisional,records:valid};
}
export function progressBasis(records:WorkoutRecord[],goal:SavedTrainingGoal|null,from:string,to:string){return JSON.stringify({from,to,goal:goal?.revision??0,records:records.filter(r=>!r.pending&&r.date>=from&&r.date<=to).map(r=>[r.id,r.revision,r.date,r.status,r.exerciseName,r.bodyPart,r.loadType,r.measurementType??'repetitions',r.sets]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])))});}
export function applicableRange(goal:SavedTrainingGoal|null,date:string,metric:'sets'|'volume'){if(!goal||goal.startMode==='unknown'||!goal.plan.confirmed||date<goal.plan.from||date>goal.plan.to||goal.startMode==='date'&&date<goal.startDate)return null;return goal.plan[metric];}
export function observedRange(values:number[]):NumericRange|null{if(values.length<5)return null;const sorted=[...values].sort((a,b)=>a-b),q=(p:number)=>{const i=(sorted.length-1)*p,lo=Math.floor(i);return sorted[lo]+(sorted[Math.ceil(i)]-sorted[lo])*(i-lo);};return {min:q(.25),max:q(.75)};}
