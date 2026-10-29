// Retrospective diagnostic of fixed shots-v1. Descriptive only: no parameter search, no promotion.
import {execFileSync} from 'node:child_process';
import {normalizeGameRows,moneyPuckShotBacktest} from './moneypuck-backtest.mjs';
import {fit} from '../shots-model.js';
import {fileURLToPath} from 'node:url';
import {pathToFileURL} from 'node:url';

const avg=rows=>rows.length?rows.reduce((s,x)=>s+x,0)/rows.length:null;
const round=n=>n===null?null:Number(n.toFixed(7));
const metrics=rows=>({n:rows.length,modelBrier:round(avg(rows.map(t=>t.loss))),baselineBrier:round(avg(rows.map(t=>t.baseline))),baselineMinusModel:round(avg(rows.map(t=>t.baseline-t.loss))),meanPredictedOver:round(avg(rows.map(t=>t.predicted))),actualOverRate:round(avg(rows.map(t=>t.outcome))),predictionBias:round(avg(rows.map(t=>t.predicted-t.outcome)))});
function group(rows,fn){const map=new Map();for(const t of rows){const k=fn(t);if(!map.has(k))map.set(k,[]);map.get(k).push(t)}return Object.fromEntries([...map].sort(([a],[b])=>a.localeCompare(b)).map(([k,rs])=>[k,metrics(rs)]))}
function bootstrapByDate(rows,replicates=2000){
 const grouped=new Map();for(const t of rows){if(!grouped.has(t.date))grouped.set(t.date,{sum:0,n:0});const g=grouped.get(t.date);g.sum+=t.baseline-t.loss;g.n++}
 const dates=[...grouped.values()],n=dates.length;let seed=20261029;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const draws=[];for(let i=0;i<replicates;i++){let sum=0,count=0;for(let j=0;j<n;j++){const x=dates[Math.floor(random()*n)];sum+=x.sum;count+=x.n}draws.push(sum/count)}
 draws.sort((a,b)=>a-b);return {method:'game-date cluster bootstrap, 2000 replicates; descriptive retrospective interval',distinctDates:n,baselineMinusModel95:[round(draws[Math.floor(.025*replicates)]),round(draws[Math.floor(.975*replicates)])]};
}
async function main(){
 const [seasonText,before,zipPath]=process.argv.slice(2);
 if(!/^\d{4}$/.test(seasonText||'')||!/^\d{4}-\d{2}-\d{2}$/.test(before||'')||!zipPath)throw Error('Usage: node scripts/shots-diagnostic.mjs SEASON BEFORE ZIP');
 const decoded=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./moneypuck-game-rows.py',import.meta.url)),zipPath,seasonText],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000}));
 const imported=normalizeGameRows(decoded.rows,{season:Number(seasonText)});
 const report=moneyPuckShotBacktest(imported,{before,includeTests:true});
 const byPlayer=new Map();for(const g of imported.games.filter(g=>g.gameDate<before)){if(!byPlayer.has(g.playerId))byPlayer.set(g.playerId,[]);byPlayer.get(g.playerId).push(g)}
 const details=report.tests.map(t=>{
  const games=byPlayer.get(t.playerId),train=games.filter(g=>g.gameDate<t.date),target=games.find(g=>g.gameDate===t.date);
  const m=fit(train,{venue:target.homeRoadFlag,opponent:target.opponentAbbrev});
  return {...t,observedShots:target.shots,mean:m.mean,alpha:m.alpha,venueFactor:m.venue,opponentFactor:m.opponent,iceTimeFactor:m.iceTime,trainingGames:m.sample};
 });
 const groupFlags=(t,k)=>Math.abs(t[k]-1)<1e-10?'neutral':t[k]>1?'up':'down';
 const output={
  season:seasonText,cutoff:before,model:report.modelVersion,archiveSha256:decoded.sha256,
  status:'DIAGNOSTIC ONLY; same retrospective season used for discovery; not an independent untouched holdout',
  headline:metrics(details),dateClusterUncertainty:bootstrapByDate(details),
  byMonth:group(details,t=>t.date.slice(0,7)),
  byPredictedOverQuintile:group(details,t=>String(Math.min(4,Math.floor(t.predicted*5)))),
  byObservedShots:group(details,t=>t.observedShots===0?'zero':t.observedShots<=2?'one_or_two':'three_plus'),
  byTrainingGames:group(details,t=>t.trainingGames<30?'20_to_29':'30_to_40'),
  byVenueFactor:group(details,t=>groupFlags(t,'venueFactor')),
  byOpponentFactor:group(details,t=>groupFlags(t,'opponentFactor')),
  byIceTimeFactor:group(details,t=>groupFlags(t,'iceTimeFactor')),
  byDispersion:group(details,t=>t.alpha===0?'poisson':'negative_binomial'),
  audit:report.audit,
  methodologicalLimits:[
   'Groupings are descriptive, selected after observing results; do not infer causal effect or optimize from these groups alone.',
   'All outcomes conditional on actual recorded player appearances; no pregame lineup or historical sportsbook odds.',
   'Game-level archive may have been revised after games; point-in-time availability not verified.',
   'Ablations or tuning require separate chronological development window and untouched later holdout.',
   'Model uses player-specific prior opponent results, not opponent-wide shot suppression.'
  ]
 };
 console.log(JSON.stringify(output,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error('Shots diagnostic failed:',e.message);process.exitCode=1});
