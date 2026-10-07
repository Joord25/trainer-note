import test from 'node:test';
import assert from 'node:assert/strict';
import {changePresentation,selectChangeCharts} from '../generated/change-card-selection.mjs';
const evidence=(id,values,metric='volume',recordIds=[id])=>({id,kind:'exercise',name:id,bodyPart:'하체',label:'기록 볼륨',metric,unit:'kg·회',recordIds,points:values.map((value,i)=>({date:`2026-09-0${i+1}`,value}))});
test('overview favors repeated dates, excludes composition and single records',()=>{
 const selected=selectChangeCharts([evidence('single',[1680]),evidence('twice',[10,20]),evidence('squat',[360,192,288]),{...evidence('all',[1,2,3,4]),kind:'composition'}]);
 assert.deepEqual(selected.map(e=>e.id),['squat','twice']);
});
test('recovery title compares the last two dates without hiding the initial reference',()=>{
 const p=changePresentation(evidence('squat',[360,192,288]));
 assert.equal(p.scope,'직전 대비');assert.equal(p.change,'+50%');assert.equal(p.baseline.value,192);assert.equal(p.last.value,288);assert.match(p.comment,/초기 360kg·회/);
});
test('overall increase and zero baseline remain accurate',()=>{
 const p=changePresentation(evidence('row',[435,522]));assert.equal(p.scope,'첫 기록 대비');assert.equal(p.change,'+20%');
 assert.equal(changePresentation(evidence('zero',[0,20])).change,'+20 kg·회');assert.equal(changePresentation(evidence('single',[10])),null);
});
test('cardio prioritizes changed speed over flat time for the same exercise',()=>{
 const speed={...evidence('speed',[5,6],'speed',['a','b']),name:'인터벌'},duration={...evidence('time',[300,300],'duration',['a','b']),name:'인터벌'};
 assert.deepEqual(selectChangeCharts([duration,speed]).map(e=>e.id),['speed']);
});
