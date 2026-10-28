import {backtest,VERSION} from '../shots-model.js';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function normalizeGameRows(rows,{season}={}){
 if(!Array.isArray(rows)||rows.length>100000||!Number.isInteger(season)||season<2008||season>2100)throw Error('Bounded game rows and season required');
 const audit={input:rows.length,nonRegular:0,noIceTime:0,zeroShotAppearances:0,duplicateCopies:0,conflictingAppearances:0},groups=new Map();
 const number=(r,key)=>{if(typeof r[key]!=='string'||!r[key].trim()||!Number.isFinite(Number(r[key]))||Number(r[key])<0)throw Error('Invalid game number');return Number(r[key])};
 for(const r of rows){
  if(r.season!==String(season)||!/^\d{7}$/.test(r.playerId||'')||!/^\d{10}$/.test(r.gameId||''))throw Error('Invalid game identity');
  if(!r.gameId.startsWith(String(season)+'02')){audit.nonRegular++;continue}
  const raw=r.gameDate,date=typeof raw==='string'?raw.replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'):null;
  if(!validDate(date)||date<`${season}-07-01`||date>=`${season+1}-07-01`||!['HOME','AWAY'].includes(r.home_or_away)||![r.playerTeam,r.opposingTeam].every(t=>/^[A-Z]{2,4}$/.test(t||''))||r.playerTeam===r.opposingTeam)throw Error('Invalid game context');
  const seconds=number(r,'icetime'),shots=number(r,'I_F_shotsOnGoal');if(!Number.isInteger(shots)||shots>50||seconds>7200)throw Error('Invalid game stats');
  if(!seconds&&shots)throw Error('Shots without ice time');
  const toi=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');if(!Number.isInteger(seconds))throw Error('Whole source seconds required');
  const game={playerId:r.playerId,gameId:r.gameId,gameDate:date,team:r.playerTeam,opponentAbbrev:r.opposingTeam,homeRoadFlag:r.home_or_away==='HOME'?'H':'R',toi,shots};
  const key=r.playerId+':'+r.gameId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(game);
 }
 const games=[];for(const copies of groups.values()){if(new Set(copies.map(g=>JSON.stringify(g))).size>1){audit.conflictingAppearances++;continue}audit.duplicateCopies+=copies.length-1;if(copies[0].toi==='0:00'){audit.noIceTime++;continue}games.push(copies[0])}
 games.sort((a,b)=>a.gameDate.localeCompare(b.gameDate)||a.playerId.localeCompare(b.playerId)||a.gameId.localeCompare(b.gameId));audit.zeroShotAppearances=games.filter(g=>g.shots===0).length;
 return {games,audit,season};
}
export function moneyPuckShotBacktest(imported,{before,line=2.5,includeTests=false}={}){
 if(!validDate(before)||!Number.isFinite(line)||line<.5||line>10||Number.isInteger(line))throw Error('Exclusive date cutoff and half-shot threshold required');
 const players=new Map();for(const g of imported.games.filter(g=>g.gameDate<before)){if(!players.has(g.playerId))players.set(g.playerId,[]);players.get(g.playerId).push(g)}
 const tests=[];let insufficientPlayers=0;
 for(const [playerId,games] of players){const result=backtest(games,line);if(!result.games)insufficientPlayers++;for(const t of result.tests){if(!(t.trainingEnd<t.date))throw Error('Training chronology failed');tests.push({...t,playerId})}}
 tests.sort((a,b)=>a.date.localeCompare(b.date)||a.playerId.localeCompare(b.playerId));
 const summarize=rows=>({forecasts:rows.length,modelBrier:avg(rows.map(t=>t.loss)),baselineBrier:avg(rows.map(t=>t.baseline)),pairedBrierImprovement:avg(rows.map(t=>t.baseline-t.loss))});
 return {attribution:'Historical research data: MoneyPuck.com — https://moneypuck.com/data.htm',sourceUrl:`https://peter-tanner.com/moneypuck/downloads/seasonPlayersSummary/skaters/${imported.season}.zip`,modelVersion:VERSION,before,line,...(includeTests?{tests}:{}),researchOnly:true,promoted:false,historicalPublicationVerified:false,audit:{...imported.audit,players:players.size,insufficientPlayers,evaluatedPlayers:new Set(tests.map(t=>t.playerId)).size,distinctDates:new Set(tests.map(t=>t.date)).size,chronologyValid:tests.every(t=>t.trainingEnd<t.date)},...summarize(tests),firstTest:tests[0]?.date||null,lastTest:tests.at(-1)?.date||null,byMonth:[...new Set(tests.map(t=>t.date.slice(0,7)))].sort().map(month=>({month,...summarize(tests.filter(t=>t.date.startsWith(month)))})),calibration:Array.from({length:5},(_,i)=>{const rows=tests.filter(t=>Math.min(4,Math.floor(t.predicted*5))===i);return {lower:i/5,upper:(i+1)/5,n:rows.length,predicted:avg(rows.map(t=>t.predicted)),observed:avg(rows.map(t=>t.outcome))}}),limitations:['Retrospective development archive; historical revisions/publication timing unverified','Conditional on recorded positive-ice-time appearances, not a pregame roster-selection test','Zero-shot appearances retained; no missing or scratched games invented','Existing fixed shots-v1 model; minimum 20 prior games, rolling 40-game fit, last 40 tests per player','Baseline uses smoothed empirical probabilities from the same prior games','Fixed half-shot threshold; no historical odds, EV or ROI claim','Player selections from one game and repeated dates are correlated','No starter/injury evidence reconstructed; no production promotion or live trial']};
}
async function main(){
 const [seasonText,before,zipPath]=process.argv.slice(2);if(!/^\d{4}$/.test(seasonText||'')||!validDate(before)||!zipPath)throw Error('Usage: node scripts/moneypuck-backtest.mjs SEASON BEFORE SKATER_ZIP');
 const decoded=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./moneypuck-game-rows.py',import.meta.url)),zipPath,seasonText],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000}));
 const imported=normalizeGameRows(decoded.rows,{season:Number(seasonText)}),report=moneyPuckShotBacktest(imported,{before});console.log(JSON.stringify({...report,archiveSha256:decoded.sha256,sourceRows:decoded.sourceRows,otherSituations:decoded.otherSituations},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('MoneyPuck game backtest failed; no production changes.');process.exitCode=1});
