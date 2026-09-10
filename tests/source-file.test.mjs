import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/source-file.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {inspectSourceFile,sourceObjectName,MAX_SOURCE_BYTES}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const pdf=new TextEncoder().encode('%PDF-1.4\nfixture');
const png=new Uint8Array([137,80,78,71,13,10,26,10,0]);
const jpeg=new Uint8Array([255,216,255,224,0,16,74,70,73,70]);
for(const [name,bytes,mime] of [['scan.pdf',pdf,'application/pdf'],['scan.PNG',png,'image/png'],['scan.jpg',jpeg,'image/jpeg'],['scan.JPEG',jpeg,'image/jpeg']])test(`detect bytes for ${name} with absent browser MIME`,async()=>{
 const inspected=await inspectSourceFile(new File([bytes],name));assert.equal(inspected.contentType,mime);assert.match(inspected.id,/^[a-f0-9]{64}$/);
});
test('same JPEG bytes deduplicate across jpg/jpeg filenames',async()=>{
 assert.equal((await inspectSourceFile(new File([jpeg],'a.jpg'))).id,(await inspectSourceFile(new File([jpeg],'b.jpeg'))).id);
});
for(const [name,bytes] of [['fake.png',pdf],['fake.pdf',png],['fake.jpg',png],['fake.png',png.slice(0,7)],['fake.jpeg',new TextEncoder().encode('<svg/>')],['file.svg',png],['empty.jpg',new Uint8Array()]])test(`reject extension/signature mismatch ${name} (${bytes.length})`,async()=>{await assert.rejects(inspectSourceFile(new File([bytes],name)));});
test('size limit is checked before reading bytes',async()=>{await assert.rejects(inspectSourceFile({name:'big.png',size:MAX_SOURCE_BYTES+1,arrayBuffer(){throw new Error('must not read');}}),/50MB/);});
test('legacy PDF and canonical image paths',()=>{
 assert.equal(sourceObjectName('application/pdf'),'source.pdf');assert.equal(sourceObjectName('image/png'),'source.png');assert.equal(sourceObjectName('image/jpeg'),'source.jpg');assert.throws(()=>sourceObjectName('image/svg+xml'));
});
