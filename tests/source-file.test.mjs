import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const compiled=ts.transpileModule(readFileSync(new URL('../src/lib/source-file.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {inspectSourceFile,sourceObjectName,sourceDisplayName,MAX_SOURCE_BYTES}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
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
test('size limit is checked before reading bytes',async()=>{await assert.rejects(inspectSourceFile({name:'big.png',size:MAX_SOURCE_BYTES+1,arrayBuffer(){throw new Error('must not read');}}),/업로드 가능한 파일 크기/);});
test('legacy PDF and canonical image paths',()=>{
 assert.equal(sourceObjectName('application/pdf'),'source.pdf');assert.equal(sourceObjectName('image/png'),'source.png');assert.equal(sourceObjectName('image/jpeg'),'source.jpg');assert.throws(()=>sourceObjectName('image/svg+xml'));
});

test('uploaded date labels display with slashes, including previously saved raw names',()=>{
 for(const [raw,expected] of [['김규동 9:21.jpg','김규동 9/21.jpg'],['김규동 9:28.jpg','김규동 9/28.jpg'],['김규동 10:5.jpg','김규동 10/5.jpg'],['김규동 09:03.PNG','김규동 09/03.PNG'],['2:29.pdf','2/29.pdf']])assert.equal(sourceDisplayName(raw),expected);
});
test('explicit renames, ordinary colons, times and invalid dates are preserved',()=>{
 assert.equal(sourceDisplayName('김규동 9:21.jpg','직접 지정 9:21.jpg'),'직접 지정 9:21.jpg');
 for(const name of ['김규동 9/21.jpg','운동:기록.jpg','김규동 13:28.jpg','김규동 9:31.jpg','김규동 9:00.jpg','김규동 9:21:30.jpg','김규동 9:21 PM.jpg','scan.jpg'])assert.equal(sourceDisplayName(name),name);
});
test('display correction leaves the original file and content identity intact',async()=>{
 const file=new File([jpeg],'김규동 9:21.jpg');
 assert.equal(sourceDisplayName(file.name),'김규동 9/21.jpg');
 assert.equal(file.name,'김규동 9:21.jpg');
 assert.deepEqual(await inspectSourceFile(file),await inspectSourceFile(new File([jpeg],'김규동 9/21.jpg')));
});
