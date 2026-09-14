import {measurementType,validMeasurement,type MeasuredWorkout} from './workout-measurements';

/** Display-only: collapse a complete, exact cardio cycle, never incomplete/unknown data. */
export function repeatedWorkoutPattern(workout:MeasuredWorkout){
 if(measurementType(workout)==='repetitions'||!validMeasurement(workout))return null;
 const sets=workout.sets;
 const signatures=sets.map(set=>JSON.stringify(Object.fromEntries(Object.entries(set).sort(([a],[b])=>a.localeCompare(b)))));
 for(let size=1;size<=sets.length/2;size++){
  if(sets.length%size===0&&signatures.every((value,index)=>value===signatures[index%size]))
   return {segments:sets.slice(0,size),repeats:sets.length/size,total:sets.length};
 }
 return null;
}
