// Predeclared, research-only advanced shots features; never used in production.
// Historical opponent defense uses only games before target date.
// Player 5on4 deployment uses only previous games; no target-game PP TOI.
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {normalizeGameRows} from './moneypuck-backtest.mjs';
import {fit,probabilities,validGames} from '../shots-model.js';

const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
const round=x=>x===null?null:Number(x.toFixed(8));
const names=['baseline','simplified','opponent_defense','power_play','combined'];
const loss=(p,y)=>(p-y)**2;
const parseNum=(x,max)=>{const n=Number(x);if(typeof x!=='string'||!x.trim()||!Number.isFinite(n)||n<0||n>max)throw Error('Invalid source stat');return n};
function validateFeatures(raw,season){
 if(!Array.isArray(raw)||raw.length>100000||!Number.isInteger(season))throw Error('Invalid feature rows');
 const all=raw.filter(r=>r.situation==='all');
 const imported=normalizeGameRows(all,{season});
 const pp=new Map();
 for(const r of raw.filter(r=>r.situation==='5on4')){
  if(r.season!==String(season)||!/^\d{7}$/.test(r.playerId)||!/^\d{10}$/.test(r.gameId))throw Error('Invalid PP identity');
  const seconds=parseNum(r.icetime,7200);
  if(!Number.isInteger(seconds))throw Error('Invalid PP seconds');
  const key=r.playerId+':'+r.gameId;
  if(pp.has(key)&&pp.get(key)!==seconds)throw Error('Conflicting PP copies');
  pp.set(key,seconds);
 }
 return {imported,pp};
}
function defenseSnapshots(games){
 const totals=new Map();
 for(const g of games){
  const key=g.gameId+':'+g.team;
  if(!totals.has(key))totals.set(key,{gameId:g.gameId,date:g.gameDate,team:g.team,opponent:g.opponentAbbrev,shots:0});
  totals.get(key).shots+=g.shots;
 }
 const byGame=new Map();
 for(const x of totals.values()){
  if(!byGame.has(x.gameId))byGame.set(x.gameId,new Map());
  byGame.get(x.gameId).set(x.team,x);
 }
 const completed=[];
 for(const x of totals.values()){
  const opponent=byGame.get(x.gameId).get(x.opponent);
  if(opponent&&opponent.opponent===x.team&&opponent.date===x.date){
   completed.push({date:x.date,team:x.team,allowed:opponent.shots});
  }
 }
 completed.sort((a,b)=>a.date.localeCompare(b.date));
 const dates=[...new Set(games.map(g=>g.gameDate))].sort(),snapshots=new Map(),history=new Map();
 let idx=0,leagueTotal=0,leagueCount=0;
 for(const date of dates){
  while(idx<completed.length&&completed[idx].date<date){
   const x=completed[idx++];if(!history.has(x.team))history.set(x.team,[]);
   history.get(x.team).push(x.allowed);leagueTotal+=x.allowed;leagueCount++;
  }
  const byTeam=new Map();
  for(const [team,values] of history){
   const recent=values.slice(-10);
   if(recent.length>=5&&leagueCount>=60){
    const league=leagueTotal/leagueCount;
    // A team allowing more shots increases the expected shot rate.
    const ratio=avg(recent)/Math.max(league,1);
    const weight=recent.length/(recent.length+20);
    byTeam.set(team,clamp(1+(ratio-1)*weight,.90,1.10));
   }
  }
  snapshots.set(date,byTeam);
 }
 return snapshots;
}
function score(rows){
 return Object.fromEntries(names.map(name=>[name,{n:rows.length,brier:round(avg(rows.map(r=>loss(r[name],r.outcome)))),
  predicted:round(avg(rows.map(r=>r[name]))),observed:round(avg(rows.map(r=>r.outcome)))}]));
}
function uncertainty(rows,name,reps=1000){
 const dates=new Map();
 for(const r of rows){if(!dates.has(r.date))dates.set(r.date,{sum:0,n:0});
  const x=dates.get(r.date);x.sum+=loss(r.simplified,r.outcome)-loss(r[name],r.outcome);x.n++;
 }
 const samples=[...dates.values()];if(!samples.length)return null;
 let seed=20261031;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const results=[];
 for(let i=0;i<reps;i++){let sum=0,n=0;for(let j=0;j<samples.length;j++){const x=samples[Math.floor(rand()*samples.length)];sum+=x.sum;n+=x.n}results.push(sum/n)}
 results.sort((a,b)=>a-b);
 return {dates:samples.length,simplifiedMinusVariant95:[round(results[Math.floor(.025*reps)]),round(results[Math.floor(.975*reps)])]};
}
export function advancedBacktest(raw,{season,cutoff,developmentEnd}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(cutoff)||!/^\d{4}-\d{2}-\d{2}$/.test(developmentEnd)||developmentEnd>=cutoff)throw Error('Invalid cutoff');
 const {imported,pp}=validateFeatures(raw,season);
 const allGames=imported.games.filter(g=>g.gameDate<cutoff),defense=defenseSnapshots(allGames);
 const byPlayer=new Map();
 for(const g of allGames){if(!byPlayer.has(g.playerId))byPlayer.set(g.playerId,[]);byPlayer.get(g.playerId).push(g)}
 const rows=[];
 for(const [playerId,playerGames] of byPlayer){
  const ordered=validGames(playerGames),start=Math.max(20,ordered.length-40);
  for(let i=start;i<ordered.length;i++){
   const target=ordered[i],prior=ordered.slice(0,i).filter(g=>g.gameDate<target.gameDate);
   const model=fit(prior,{venue:target.homeRoadFlag,opponent:target.opponentAbbrev});
   if(!model)continue;
   const recent=prior.slice(-40),baseline=(recent.filter(g=>g.shots>2.5).length+.5)/(recent.length+1);
   const mean=clamp(.5*model.base+.5*model.recent,.01,15);
   const opponentFactor=defense.get(target.gameDate)?.get(target.opponentAbbrev)??1;
   const ppValues=recent.map(g=>pp.get(g.playerId+':'+g.gameId)??0);
   const ppAvg=avg(ppValues),ppRecent=avg(ppValues.slice(-10));
   const ppFactor=ppValues.length>=20&&ppAvg>=30?clamp(1+.2*(ppRecent-ppAvg)/Math.max(ppAvg,60),.90,1.10):1;
   const predict=m=>probabilities(clamp(m,.01,15),model.alpha,2.5).over;
   rows.push({playerId,date:target.gameDate,trainingEnd:prior.at(-1).gameDate,outcome:Number(target.shots>2.5),
    baseline,simplified:predict(mean),opponent_defense:predict(mean*opponentFactor),
    power_play:predict(mean*ppFactor),combined:predict(mean*opponentFactor*ppFactor),
    opponentAvailable:opponentFactor!==1,ppAvailable:ppAvg>=30});
  }
 }
 if(!rows.every(r=>r.trainingEnd<r.date))throw Error('Future-data leakage');
 const dev=rows.filter(r=>r.date<developmentEnd),later=rows.filter(r=>r.date>=developmentEnd);
 if(!dev.length||!later.length)throw Error('Insufficient split');
 const d=score(dev),l=score(later);
 const selected=['simplified','opponent_defense','power_play','combined'].reduce((best,name)=>d[name].brier<d[best].brier?name:best,'simplified');
 return {season,cutoff,developmentEnd,source:'MoneyPuck historical skater game-by-game',
  modelStatus:'research only; NOT promoted',selectedOnDevelopment:selected,
  definitions:{simplified:'fixed shots-v1 mean without venue, opponent-history or recent-TOI multipliers',
   opponent_defense:'prior-date opponent team skater shots allowed in last 10 team games, league normalized, n/(n+20) shrink, +/-10% cap',
   power_play:'player prior 5on4 seconds last 10 vs last 40, coefficient 0.2, +/-10% cap, minimum 30 sec average',
   combined:'multiply opponent defense and power-play factors'},
  development:d,laterEvaluation:l,selectedLaterVsSimplified:round(l.simplified.brier-l[selected].brier),
  uncertainty:Object.fromEntries(['opponent_defense','power_play','combined'].map(name=>[name,uncertainty(later,name)])),
  checks:{total:rows.length,development:dev.length,later:later.length,players:byPlayer.size,
   opponentAvailable:rows.filter(r=>r.opponentAvailable).length,ppAvailable:rows.filter(r=>r.ppAvailable).length,
   chronologyValid:true,developmentDates:new Set(dev.map(r=>r.date)).size,laterDates:new Set(later.map(r=>r.date)).size},
  limitations:['Retrospective research: archives may have been revised after games.',
   '2025-26 data has been inspected in previous experiments and cannot serve as an untouched holdout.',
   '2024-25 development and later evaluation are separate chronological periods but same-season historical data.',
   'Team skater shots are a proxy for shots allowed; missing/duplicate game rows could bias estimates.',
   'Player PP time and team defense are strictly prior-date; lineup availability at betting time is not reconstructed.',
   'No sportsbook prices, EV, CLV, ROI, profitability or production promotion.']};
}
async function main(){
 const [seasonText,cutoff,zipPath,developmentEnd]=process.argv.slice(2);
 if(!/^\d{4}$/.test(seasonText||'')||!zipPath||!developmentEnd)throw Error('Usage: node scripts/shots-advanced.mjs SEASON CUTOFF ZIP DEVELOPMENT_END');
 const decoded=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./moneypuck-advanced-rows.py',import.meta.url)),zipPath,seasonText],{encoding:'utf8',maxBuffer:96*1024*1024,timeout:120000}));
 console.log(JSON.stringify({...advancedBacktest(decoded.rows,{season:Number(seasonText),cutoff,developmentEnd}),archiveSha256:decoded.sha256},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error('Advanced shots research failed:',e.message);process.exitCode=1});
