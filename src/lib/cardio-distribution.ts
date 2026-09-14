import {measurementType,type MeasuredWorkout} from './workout-measurements';
type CardioRecord=MeasuredWorkout & {exerciseName:string;date:string;bodyPart?:string};
/** Classify only explicit endurance machines/activities; timed planks and resistance rows are not cardio. */
export function isCardioWorkout(r:Pick<CardioRecord,'measurementType'|'exerciseName'|'bodyPart'>){
 if(r.bodyPart==='유산소')return true;
 if(['가슴','등','어깨','이두','삼두','하체','코어'].includes(r.bodyPart??''))return false;
 if(measurementType(r)==='incline_speed_time')return true;
 const name=(r.exerciseName??'').normalize('NFKC').toLowerCase().replace(/[\s_-]/g,'');
 return /에어바이크머신|어썰트바이크|마이마운틴|마이마운타인|러닝머신|런닝머신|트레드밀|인터벌러닝|인터벌런닝|로잉머신|로잉에르고미터|스키에르고미터|스키에르그|스키에르그미터|실내자전거|고정식자전거|사이클머신|스텝밀|천국의계단|엘립티컬|airbikemachine|assaultbike|mymountain|treadmill|rowingmachine|skierg|cycleergometer|intervalrunning|stationarybike/.test(name)||/^(러닝|런닝|조깅|사이클|수영|로잉|running|jogging|cycling|rowing)$/.test(name);
}
export function cardioDistribution<T extends CardioRecord>(records:T[]){
 const rows=records.filter(isCardioWorkout),sets=rows.flatMap(r=>r.sets),timed=sets.filter(s=>typeof s.durationSeconds==='number'&&Number.isFinite(s.durationSeconds)&&s.durationSeconds>0);
 return {records:rows,days:new Set(rows.map(r=>r.date)).size,segments:sets.length,seconds:timed.length?timed.reduce((n,s)=>n+s.durationSeconds!,0):null,missingTime:sets.length-timed.length};
}
export type CardioDistribution=ReturnType<typeof cardioDistribution>;
