import {formatWorkoutSet,type MeasuredWorkout} from '../lib/workout-measurements';
import {repeatedWorkoutPattern} from '../lib/workout-display';

export function IntervalPattern({workout}:{workout:MeasuredWorkout}){
 const pattern=repeatedWorkoutPattern(workout);
 if(!pattern)return null;
 return <span className="interval-pattern" role="group" aria-label={`${pattern.segments.length}구간을 ${pattern.repeats}회 반복, 전체 ${pattern.total}구간`}>
  <span className="interval-pattern-caption"><strong>{pattern.segments.length}구간 × {pattern.repeats}회 반복</strong><small>전체 {pattern.total}구간</small></span>
  <span className="interval-pattern-steps">{pattern.segments.map((segment,index)=><span className="interval-pattern-step" key={index}><small>{index+1}</small><b>{formatWorkoutSet(workout,segment)}</b></span>)}</span>
 </span>;
}
