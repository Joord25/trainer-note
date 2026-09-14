import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trainerAi} from '../index.mjs';
const data={action:'chat',memberId:'missing-capture-boundary-member',fileId:'',question:'캡처한 내용을 설명해줘',requestId:'12345678-1234-4234-a234-123456789012'};
const run=patch=>trainerAi.run({auth:{uid:'capture-boundary-test'},data:{...data,...patch}});
test('callable accepts fileless chat and reaches member authorization',async()=>{
 for(const patch of [{},{selection:{kind:'screen',page:0}}])await assert.rejects(run(patch),e=>e.code==='not-found'&&e.message==='회원 정보를 찾을 수 없어요.');
});
test('callable retains authentication and rejects invalid file IDs for source operations',async()=>{
 await assert.rejects(trainerAi.run({data}),e=>e.code==='unauthenticated');
 for(const patch of [{fileId:'../foreign'},{fileId:123},{fileId:null},{action:'read'},{action:'review'},{action:'report'}])await assert.rejects(run(patch),e=>e.code==='invalid-argument');
});

test('callable rejects oversized payloads before any database lookup',async()=>{
 await assert.rejects(run({extra:'x'.repeat(1024*1024)}),e=>e.code==='invalid-argument');
});
