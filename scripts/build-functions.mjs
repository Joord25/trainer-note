import fs from 'node:fs';
import ts from 'typescript';
fs.mkdirSync('functions/generated',{recursive:true});
for(const [file,name] of [['cardio-distribution','cardio-distribution'],['ai-usage-policy','ai-usage-policy'],['goal-visual','goal-visual'],['progress-analysis','progress-analysis'],['goal-coaching','goal-coaching'],['assessment-results','assessment-results'],['training-assessment','training-assessment'],['training-goals','training-goals'],['review-alerts','review-alerts'],['workout-extraction','extraction'],['workout-measurements','workout-measurements']]){
 const source=fs.readFileSync(`src/lib/${file}.ts`,'utf8');
 fs.writeFileSync(`functions/generated/${name}.mjs`,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replaceAll("'./cardio-distribution'", "'./cardio-distribution.mjs'").replaceAll("'./progress-analysis'", "'./progress-analysis.mjs'").replaceAll("'./training-goals'", "'./training-goals.mjs'").replaceAll("'./goal-coaching'", "'./goal-coaching.mjs'").replaceAll("'./assessment-results'", "'./assessment-results.mjs'").replaceAll("'./training-assessment'", "'./training-assessment.mjs'").replaceAll("'./workout-measurements'", "'./workout-measurements.mjs'"));
}
