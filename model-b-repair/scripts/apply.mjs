import {readFile,writeFile,readdir,copyFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(process.argv[2]||'.'),bundle=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const manifest=JSON.parse(await readFile(join(bundle,'baseline.json'),'utf8'));
// Verify every dependency before editing; never write to a different version silently.
for(const [path,expected] of Object.entries(manifest.sha256)) {
 const actual=createHash('sha256').update(await readFile(join(root,path))).digest('hex');
 if(actual!==expected)throw Error('Production source drift: '+path);
}
const names=(await readdir(join(bundle,'worker'))).sort();
for(const name of names)await copyFile(join(bundle,'worker',name),join(root,'worker',name));
let collector=await readFile(join(root,'worker/collector.js'),'utf8');
collector="import {modelBRoute,modelBNotification} from './model-b-route.js';\n"+collector;
collector=collector.replace(" const path=new URL(request.url).pathname;", " const path=new URL(request.url).pathname;\n if(['/collector/api/model-b','/collector/api/model-b/grade','/collector/api/model-b/refresh-odds'].includes(path))return modelBRoute(request,env,officialConfig);");
collector=collector.replace("return shadowModelWithOperations(request,env,officialConfig);","return modelBRoute(request,env,officialConfig);");
collector=collector.replace("if(path==='/collector/api/shadow-late-odds')return shadowLateGuarded(request,env,officialConfig);", "if(path==='/collector/api/shadow-late-odds'){if(request.method==='GET')return shadowLateOdds(request,env,officialConfig);return modelBRoute(new Request(new URL('/collector/api/model-b/refresh-odds',request.url),request),env,officialConfig);}");
collector=collector.replace(" if(['/collector/api/shadow-notification/a'", " if(path==='/collector/api/shadow-notification/b')return modelBNotification(request,env,officialConfig);\n if(['/collector/api/shadow-notification/a'");
await writeFile(join(root,'worker/collector.js'),collector);
let build=await readFile(join(root,'scripts/build-collector.mjs'),'utf8');
const definition="const modelBRaw=(await Promise.all("+JSON.stringify(names.map(n=>'worker/'+n))+".map(p=>readFile(p,'utf8')))).join('\\n');\nconst modelBCodeHash=createHash('sha256').update(modelBRaw).digest('hex');\nconst modelBCode=modelBRaw.replace(/^import .*;$/gm,'').replaceAll('export const','const').replaceAll('export async function','async function').replaceAll('export function','function');\n";
build=build.replace("const source=reportCode",definition+"const source=modelBCode+'\\n'+reportCode");
build=build.replaceAll('factorCodeHash:${JSON.stringify(factorCodeHash)}','modelBCodeHash:${JSON.stringify(modelBCodeHash)},factorCodeHash:${JSON.stringify(factorCodeHash)}');
build=build.replace('factorShadowContext,shadowNotification);','factorShadowContext,modelBCombinedNotification);');
build=build.replace('},shadowModelWithOperations,shadowOddsDB);','},modelBRoute,shadowOddsDB);');
await writeFile(join(root,'scripts/build-collector.mjs'),build);
let ui=await readFile(join(root,'preview-source/assets/premium-live.js'),'utf8');
ui=ui.replace("{name:'Model B v2'", "{name:'Model B (current)'");
ui=ui.replace('    const missing=keys.filter', `    if(data.shadow?.rankings){
      const report=data.shadow.rankings,box=panel('Model B nightly rankings · Research only');
      box.append(node('p','Evaluated '+when(report.checkedAt)+'. Ranked candidates are separate from paper selections.'));
      const rows=report.topThree.map(c=>[String(c.rank),c.away+' at '+c.home,c.side,pct(c.probability),pct(c.edge),c.book+' '+american(c.american),c.qualifies?'Qualifies':c.reasons.map(label).join('; ')]);
      box.append(rows.length?table('Model B research rankings',['Rank','Matchup','Side','Probability','Edge','Odds','Qualification'],rows):node('p','No candidates currently have valid pregame prices and critical inputs.'));
      for(const c of report.topThree){const detail=node('details'),summary=node('summary',c.away+' at '+c.home+' · Context');detail.append(summary,node('pre',JSON.stringify(c.context,null,2)));box.append(detail);}
      $('view').append(box);
    }
    const missing=keys.filter`);
await writeFile(join(root,'preview-source/assets/premium-live.js'),ui);
let reports=await readFile(join(root,'worker/live-pull-reports.js'),'utf8');
reports=reports.replace("reportWindow(db,'shadow-b-v2-runs',start,end),", "Promise.all([reportWindow(db,'shadow-b-v2-runs',start,end),reportWindow(db,'shadow-b-v4-runs',start,end)]).then(groups=>groups.flat().sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt))),");
reports=reports.replace('decisions:notification.sections, warnings:notification.warnings,', "decisions:notification.sections?.map(section=>section.model?.startsWith('B')&&modelB?{...section,evaluatedAt:modelB.capturedAt,games:modelB.data.decisions,rankings:modelB.data.rankings||null}:section), warnings:notification.warnings,");
await writeFile(join(root,'worker/live-pull-reports.js'),reports);
for(const dir of ['tests','scripts'])for(const name of await readdir(join(bundle,dir))){if(name==='apply.mjs')continue;await copyFile(join(bundle,dir,name),join(root,dir,name));}
console.log('Applied versioned Model B proposal locally; no commit, push, migration or deployment performed.');
