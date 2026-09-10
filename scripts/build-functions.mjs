import fs from 'node:fs';
import ts from 'typescript';
fs.mkdirSync('functions/generated',{recursive:true});
const source=fs.readFileSync('src/lib/workout-extraction.ts','utf8');
fs.writeFileSync('functions/generated/extraction.mjs',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);
