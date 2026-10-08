export type MeasurementType = 'repetitions' | 'distance_time' | 'duration' | 'distance' | 'weight_distance' | 'incline_speed_time';
export type WorkoutSet = {kg:number|null;reps:number;leftReps?:number;rightReps?:number;distanceMeters?:number|null;durationSeconds?:number|null;inclinePercent?:number|null;speedKph?:number|null};
export type MeasuredWorkout = {measurementType?:MeasurementType;loadType:string;sets:WorkoutSet[]};
export const measurementLabels:Record<MeasurementType,string>={repetitions:'중량·횟수',distance_time:'거리·시간',duration:'시간',distance:'거리',weight_distance:'무게·거리',incline_speed_time:'경사·속도·시간'};
export function measurementType(v:{measurementType?:MeasurementType}):MeasurementType{return v.measurementType??'repetitions';}
export function validMeasurement(v:MeasuredWorkout):boolean {
 const kind=measurementType(v),cardio=kind!=='repetitions';
 if(!['weighted','bodyweight','unknown','mixed'].includes(v.loadType)||!Object.hasOwn(measurementLabels,kind)||!Array.isArray(v.sets)||v.sets.length<1||v.sets.length>8||cardio&&(kind==='weight_distance'?v.loadType!=='weighted':v.loadType!=='unknown'))return false;
 const positive=(n:unknown,max:number)=>typeof n==='number'&&Number.isFinite(n)&&n>0&&n<=max;
 return v.sets.every(s=>{
  if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['kg','reps','distanceMeters','durationSeconds','leftReps','rightReps','inclinePercent','speedKph'].includes(k)))return false;
  const sided='leftReps' in s||'rightReps' in s;
  const sidesValid=Number.isInteger(s.leftReps)&&typeof s.leftReps==='number'&&s.leftReps>=0&&s.leftReps<=1000&&Number.isInteger(s.rightReps)&&typeof s.rightReps==='number'&&s.rightReps>=0&&s.rightReps<=1000&&s.reps===s.leftReps!+s.rightReps!;
  if(kind==='weight_distance')return !sided&&typeof s.kg==='number'&&Number.isFinite(s.kg)&&s.kg>=0&&s.kg<=2000&&s.reps===0&&positive(s.distanceMeters,1000000)&&!('durationSeconds' in s)&&!('inclinePercent' in s)&&!('speedKph' in s);
  if(kind==='incline_speed_time')return !sided&&s.kg===null&&s.reps===0&&!('distanceMeters' in s)&&typeof s.inclinePercent==='number'&&Number.isFinite(s.inclinePercent)&&s.inclinePercent>=-100&&s.inclinePercent<=100&&typeof s.speedKph==='number'&&Number.isFinite(s.speedKph)&&s.speedKph>=0&&s.speedKph<=100&&positive(s.durationSeconds,86400);
  if('inclinePercent' in s||'speedKph' in s)return false;
  if(!cardio)return !('distanceMeters' in s)&&!('durationSeconds' in s)&&Number.isInteger(s.reps)&&s.reps>=1&&(sided?sidesValid:s.reps<=1000)&&(v.loadType==='weighted'?positive(s.kg,2000):v.loadType==='mixed'?s.kg===null||positive(s.kg,2000):s.kg===null);
  return !sided&&s.kg===null&&s.reps===0&&(kind==='duration'?!('distanceMeters' in s):positive(s.distanceMeters,1000000))&&(kind==='distance'?!('durationSeconds' in s):positive(s.durationSeconds,86400));
 });
}
export function formatWorkoutSet(v:MeasuredWorkout,s:WorkoutSet):string {
 switch(measurementType(v)){
  case 'incline_speed_time':return `경사 ${s.inclinePercent??'?'}% · ${s.speedKph??'?'}km/h · ${s.durationSeconds??'?'}초`;
  case 'distance_time':return `${s.distanceMeters??'?'}m / ${s.durationSeconds??'?'}초`;
  case 'duration':return `${s.durationSeconds??'?'}초`;
  case 'weight_distance':return `${s.kg??'?'}kg · ${s.distanceMeters??'?'}m`;
  case 'distance':return `${s.distanceMeters??'?'}m`;
  default:return `${(v.loadType==='bodyweight'||v.loadType==='mixed'&&s.kg===null)?'맨몸':s.kg===null?'중량 미상':s.kg+'kg'} × ${formatRepetitions(s)}`;
 }
}
export function blankSet(kind:MeasurementType):WorkoutSet {return kind==='weight_distance'?{kg:null,reps:0,distanceMeters:null}:kind==='incline_speed_time'?{kg:null,reps:0,inclinePercent:null,speedKph:null,durationSeconds:null}:kind==='repetitions'?{kg:null,reps:0}:{kg:null,reps:0,...(kind!=='duration'?{distanceMeters:null}:{}),...(kind!=='distance'?{durationSeconds:null}:{})};}

// For unilateral sets, reps is the total; the two sides still count as one set.
export function formatRepetitions(s:WorkoutSet):string {return s.leftReps!==undefined||s.rightReps!==undefined?s.leftReps===s.rightReps?`좌우 각 ${s.leftReps??'?'}회`:`L ${s.leftReps??'?'}회 / R ${s.rightReps??'?'}회`:`${s.reps||'?'}회`;}

// Retain compatible measurements when changing the editor type; never infer a missing unit.
export function convertWorkoutSets(sets:WorkoutSet[],kind:MeasurementType):WorkoutSet[]{return sets.map(s=>{const blank=blankSet(kind);return Object.fromEntries(Object.entries(blank).map(([key,value])=>[key,key==='reps'?value:key==='kg'&&kind!=='weight_distance'?value:s[key as keyof WorkoutSet]??value])) as WorkoutSet;});}

// Ignore spacing/case only; equipment, variants, and measurement conditions remain distinct.
export function exerciseNameKey(name:string){return name.normalize('NFC').replace(/\s+/gu,'').toLowerCase();}
export function exerciseIdentity(record:{exerciseName:string;bodyPart:string;measurementType?:MeasurementType}){return JSON.stringify([exerciseNameKey(record.exerciseName),record.bodyPart,measurementType(record)]);}
