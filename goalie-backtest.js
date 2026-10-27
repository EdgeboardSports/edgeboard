// Offline paired validation. No feeds, odds synthesis, tuning or promotion.
import {fitGame,goalieAdjustedChallenger,marketProbabilities,gradeGame,GAME_VERSION} from './game-model.js';
const average=a=>a.length?a.reduce((s,n)=>s+n,0)/a.length:null;
const defaults=[{market:'h2h',side:'Home',line:null},{market:'h2h_3_way',side:'Draw',line:null},{market:'spreads',side:'Home',line:-1.5},{market:'totals',side:'Over',line:6.5}];
const validDate=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
function validGame(g){
 if(!g||!validDate(g.date)||!Number.isInteger(g.id)||!['home','away'].every(k=>/^[A-Z]{3}$/.test(g[k]||''))||g.home===g.away||!Number.isFinite(Date.parse(g.startTime))||!['REG','OT','SO'].includes(g.endType))return false;
 if(!['homeGoals','awayGoals','finalHome','finalAway'].every(k=>Number.isInteger(g[k])&&g[k]>=0&&g[k]<=30)||g.finalHome===g.finalAway)return false;
 return g.endType==='REG'?g.homeGoals===g.finalHome&&g.awayGoals===g.finalAway:Math.abs(g.finalHome-g.finalAway)===1&&g.homeGoals===Math.min(g.finalHome,g.finalAway)&&g.awayGoals===g.homeGoals;
}
function scores(p,result,market){
 const distribution=market==='h2h_3_way'?p.regulation:{win:p.win,loss:p.loss,push:p.push},outcome=market==='h2h_3_way'?result.regulation:result.state;
 return {brier:Object.entries(distribution).reduce((s,[k,v])=>s+(v-Number(k===outcome))**2,0)/2,logLoss:-Math.log(Math.max(1e-15,distribution[outcome])),winProbability:p.win,won:result.state==='win'};
}
function summarize(tests,key){
 const bins=Array.from({length:5},()=>({n:0,predicted:0,observed:0}));
 for(const t of tests){const score=t[key],bin=bins[Math.min(4,Math.floor(score.winProbability*5))];bin.n++;bin.predicted+=score.winProbability;bin.observed+=Number(score.won)}
 return {n:tests.length,brier:average(tests.map(t=>t[key].brier)),logLoss:average(tests.map(t=>t[key].logLoss)),calibration:bins.map((b,i)=>({lower:i/5,upper:(i+1)/5,n:b.n,predicted:b.n?b.predicted/b.n:null,observed:b.n?b.observed/b.n:null}))};
}
export function goalieBacktest(archive,snapshots,{before,markets=defaults}={}){
 if(!validDate(before)||!Array.isArray(archive?.games)||!Array.isArray(snapshots))throw Error('Archive, pregame snapshot array and exclusive date cutoff required');
 for(const q of markets)marketProbabilities({home:3,away:3,overtimeHome:.5},q.market,q.side,q.line);
 const audit={invalidArchiveRows:0,duplicateArchiveCopies:0,conflictingArchiveRows:0,missingSnapshots:0,ambiguousSnapshots:0,invalidPregameEvidence:0,insufficientTraining:0,missingGoalieQuality:0};
 const grouped=new Map();for(const g of archive.games){if(!validGame(g)){audit.invalidArchiveRows++;continue}if(!grouped.has(g.id))grouped.set(g.id,[]);grouped.get(g.id).push(g)}
 const games=[];for(const group of grouped.values()){if(new Set(group.map(g=>JSON.stringify(g))).size>1){audit.conflictingArchiveRows+=group.length;continue}audit.duplicateArchiveCopies+=group.length-1;games.push(group[0])}
 games.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
 const reports=markets.map(q=>({...q,tests:[]}));let pairedGames=0;
 for(const game of games.filter(g=>g.date<before)){
  const model=fitGame(games,game.home,game.away,game.date);if(!model){audit.insufficientTraining++;continue}
  const matching=snapshots.filter(s=>String(s?.event?.nhlGameId)===String(game.id));
  if(!matching.length){audit.missingSnapshots++;continue}
  // Earliest recorded snapshot is chosen without inspecting the eventual outcome.
  const ordered=matching.filter(s=>Number.isFinite(Date.parse(s.capturedAt))).sort((a,b)=>Date.parse(a.capturedAt)-Date.parse(b.capturedAt));
  const first=ordered[0],ties=ordered.filter(s=>Date.parse(s.capturedAt)===Date.parse(first?.capturedAt));
  if(new Set(ties.map(s=>JSON.stringify(s))).size>1){audit.ambiguousSnapshots++;continue}
  const event=first?.event,cutoff=Date.parse(first?.capturedAt),start=Date.parse(game.startTime);
  if(!event||!(cutoff<start)||event.date!==game.date||event.homeAbbrev!==game.home||event.awayAbbrev!==game.away||Date.parse(event.startTime||event.commenceTime)!==start||Date.parse(event.gameDay?.checkedAt)>cutoff||['home','away'].some(side=>{const at=event.gameDay?.[side]?.goalie?.sourceUpdatedAt;return at!=null&&(!Number.isFinite(Date.parse(at))||Date.parse(at)>cutoff)})){audit.invalidPregameEvidence++;continue}
  const challenger=goalieAdjustedChallenger(model,event,first.goalieEvidence,cutoff);
  if(!challenger.available){audit.missingGoalieQuality++;continue}
  pairedGames++;
  const official={gameState:'OFF',homeTeam:{score:game.finalHome},awayTeam:{score:game.finalAway},gameOutcome:{lastPeriodType:game.endType}};
  for(const report of reports){
   const {market,side,line}=report,result=gradeGame({market,side,line,quote:{decimal:2}},official);
   const base=marketProbabilities(model,market,side,line),adjusted=marketProbabilities(challenger.model,market,side,line);
   report.tests.push({gameId:game.id,date:game.date,capturedAt:first.capturedAt,trainingEnd:model.trainingEnd,base:scores(base,result,market),challenger:scores(adjusted,result,market)});
  }
 }
 return {baseVersion:GAME_VERSION,challengerVersion:'goalie-challenger-v1',before,eligibleArchiveGames:games.filter(g=>g.date<before).length,pairedGames,audit,promoted:false,markets:reports.map(r=>{const base=summarize(r.tests,'base'),challenger=summarize(r.tests,'challenger');return {...r,base,challenger,pairedBrierImprovement:base.brier===null?null:base.brier-challenger.brier}}),limitations:['Only games with archived pregame evidence can enter paired evaluation','Historical starter or quality data must not be reconstructed from final game reports','Fixed line thresholds are illustrative; no historical sportsbook prices or ROI','Calibration bins describe the selected outcome; three-way Brier/log loss use all regulation outcomes','No model tuning, significance claim or automatic promotion']};
}
