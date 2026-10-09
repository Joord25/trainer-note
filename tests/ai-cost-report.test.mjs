import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const js=ts.transpileModule(fs.readFileSync(new URL('../src/lib/ai-cost-report.ts',import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {estimateUsage,formatUsageMoney,usageMonths}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('usage scenarios use per-API-call means and expose missing baselines',()=>{
 const rows=[{id:'extraction',averageMicros:150},{id:'chat-quick',averageMicros:200},{id:'planning',averageMicros:0}];
 assert.deepEqual(estimateUsage(rows,{extraction:100,'chat-quick':20,planning:5}),{micros:19000,missing:[]});
 assert.deepEqual(estimateUsage(rows,{'chat-deep':10}),{micros:0,missing:['chat-deep']});assert.deepEqual(estimateUsage(rows,{'chat-deep':0}),{micros:0,missing:[]});
});
test('USD is default, manual won conversion stays explicit and periods cross years',()=>{
 assert.equal(formatUsageMoney(null),'—');assert.equal(formatUsageMoney(1500),'$0.0015');assert.equal(formatUsageMoney(1000000,1400),'약 ₩1,400');const months=usageMonths('2026-01');assert.equal(months.length,24);assert.equal(months[1],'2025-12');assert.equal(months.at(-1),'2024-02');
});
