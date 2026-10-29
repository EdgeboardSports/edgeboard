// Research-only, predeclared five-variant shots-v1 comparison.
// No production model changes. Later-period evaluation is chronological but not untouched:
// the 2025-26 archive has already been inspected during prior diagnostics.
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {normalizeGameRows} from './moneypuck-backtest.mjs';
import {fit,probabilities,validGames} from '../shots-model.js';

const VARIANTS=Object.freeze({
 original:{venue:1,opponent:1,iceTime:1},
 half_ice_time:{venue:1,opponent:1,iceTime:0.5},
 half_venue:{venue:0.5,opponent:1,iceTime:1},
 half_opponent:{venue:1,opponent:0.5,iceTime:1},
 simplified:{venue:0,opponent:0,iceTime:0}
});
const LINE=2.5;
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const rounded=x=>x===null?null:Number(x.toFixed(8));
function brier(p,y){return (p-y)**2}
function logLoss(p,y){const q=Math.max(1e-10,Math.min(1-1e-10,p));return -(y*Math.log(q)+(1-y)*Math.log(1-q))}
function summarize(rows,key){
 const n=rows.length;
 return {n,brier:rounded(avg(rows.map(r=>brier(r[key],r.outcome)))),
 logLoss:rounded(avg(rows.map(r=>logLoss(r[key],r.outcome)))),
 predictedOver:rounded(avg(rows.map(r=>r[key]))),
 observedOver:rounded(avg(rows.map(r=>r.outcome)))};
}
function bootstrap(rows,variant,replicates=2000){
 const grouped=new Map();
 for(const row of rows){if(!grouped.has(row.date))grouped.set(row.date,{n:0,sumVsBaseline:0,sumVsOriginal:0});const g=grouped.get(row.date);
  g.n++;g.sumVsBaseline+=brier(row.baseline,row.outcome)-brier(row[variant],row.outcome);
  g.sumVsOriginal+=brier(row.original,row.outcome)-brier(row[variant],row.outcome);
 }
 const dates=[...grouped.values()],N=dates.length;
 if(!N)return null;
 let seed=20261030;
 const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const a=[],b=[];
 for(let i=0;i<replicates;i++){let n=0,x=0,y=0;for(let j=0;j<N;j++){const g=dates[Math.floor(rand()*N)];n+=g.n;x+=g.sumVsBaseline;y+=g.sumVsOriginal}a.push(x/n);b.push(y/n)}
 a.sort((x,y)=>x-y);b.sort((x,y)=>x-y);
 const ci=x=>[rounded(x[Math.floor(replicates*.025)]),rounded(x[Math.floor(replicates*.975)])];
 return {dates:N,replicates,baselineMinusVariant95:ci(a),originalMinusVariant95:ci(b)};
}
export function compareVariants(imported,{before='2026-07-01',developmentEnd='2026-01-15'}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(before)||!/^\d{4}-\d{2}-\d{2}$/.test(developmentEnd)||developmentEnd>=before)throw Error('Chronological cutoff required');
 const players=new Map();
 for(const game of imported.games.filter(g=>g.gameDate<before)){
  if(!players.has(game.playerId))players.set(game.playerId,[]);
  players.get(game.playerId).push(game);
 }
 const rows=[];
 for(const [playerId,playerGames] of players){
  const ordered=validGames(playerGames),start=Math.max(20,ordered.length-40);
  for(let i=start;i<ordered.length;i++){
   const target=ordered[i],train=ordered.slice(0,i).filter(g=>g.gameDate<target.gameDate);
   const model=fit(train,{venue:target.homeRoadFlag,opponent:target.opponentAbbrev});
   if(!model)continue;
   const baselineHistory=train.slice(-40),baseline=(baselineHistory.filter(g=>g.shots>LINE).length+0.5)/(baselineHistory.length+1);
   const row={playerId,date:target.gameDate,outcome:Number(target.shots>LINE),baseline,trainingEnd:train.at(-1).gameDate};
   const unadjustedMean=.5*model.base+.5*model.recent;
   for(const [name,weights] of Object.entries(VARIANTS)){
    const factor=(value,weight)=>1+(value-1)*weight;
    const mean=Math.max(.01,Math.min(15,unadjustedMean*factor(model.venue,weights.venue)*factor(model.opponent,weights.opponent)*factor(model.iceTime,weights.iceTime)));
    row[name]=probabilities(mean,model.alpha,LINE).over;
   }
   if(!(row.trainingEnd<row.date))throw Error('Look-ahead detected');
   rows.push(row);
  }
 }
 const development=rows.filter(r=>r.date<developmentEnd),evaluation=rows.filter(r=>r.date>=developmentEnd);
 if(!development.length||!evaluation.length)throw Error('Both chronological periods need eligible forecasts');
 const summarizePeriod=rs=>Object.fromEntries(['baseline',...Object.keys(VARIANTS)].map(name=>[name,summarize(rs,name)]));
 const developmentScores=summarizePeriod(development);
 // Deterministic tie-break: original first, then predeclared order.
 const selected=Object.keys(VARIANTS).reduce((best,name)=>developmentScores[name].brier<developmentScores[best].brier?name:best,'original');
 const evalScores=summarizePeriod(evaluation);
 return {source:'MoneyPuck.com game-by-game historical skaters',researchOnly:true,promoted:false,
  line:LINE,season:imported.season,before,developmentEnd,variantDefinitions:VARIANTS,
  split:{development:'target date < developmentEnd',laterEvaluation:'target date >= developmentEnd',method:'chronological; no target-day features',caveat:'2025-26 data previously inspected; later evaluation is NOT an untouched holdout'},
  development:developmentScores,selectedOnDevelopment:selected,laterEvaluation:evalScores,
  selectedLaterVsBaseline:rounded(evalScores.baseline.brier-evalScores[selected].brier),
  selectedLaterVsOriginal:rounded(evalScores.original.brier-evalScores[selected].brier),
  selectedLaterUncertainty:bootstrap(evaluation,selected),
  allVariantsLaterUncertainty:Object.fromEntries(Object.keys(VARIANTS).map(name=>[name,bootstrap(evaluation,name,1000)])),
  checks:{chronologyValid:rows.every(r=>r.trainingEnd<r.date),total:rows.length,development:development.length,laterEvaluation:evaluation.length,
   players:new Set(rows.map(r=>r.playerId)).size,developmentDates:new Set(development.map(r=>r.date)).size,laterDates:new Set(evaluation.map(r=>r.date)).size},
  limitations:['The same season was previously analyzed; this is a controlled retrospective comparison, not independent prospective validation.',
   'Five variants predeclared in code; no post-hoc winner promotion or hyperparameter search.',
   'Appearance-conditioned samples; scratches and historical sportsbook prices absent.',
   'Only the 2.5 shots threshold was evaluated; no ROI, CLV, or betting profitability claim.',
   'Source archives may have been revised; historical pregame availability not independently verified.',
   'Date-cluster bootstrap reflects sampling variation but not selection bias or historical revisions.']};
}
async function main(){
 const [seasonText,before,zipPath,developmentEnd='2026-01-15']=process.argv.slice(2);
 if(!/^\d{4}$/.test(seasonText||'')||!zipPath)throw Error('Usage: node scripts/shots-variants.mjs SEASON BEFORE ZIP [DEVELOPMENT_END]');
 const decoded=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./moneypuck-game-rows.py',import.meta.url)),zipPath,seasonText],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000}));
 const imported=normalizeGameRows(decoded.rows,{season:Number(seasonText)});
 console.log(JSON.stringify({...compareVariants(imported,{before,developmentEnd}),archiveSha256:decoded.sha256,sourceRows:decoded.sourceRows},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error('Shots variant comparison failed:',e.message);process.exitCode=1});
