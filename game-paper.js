import {GAME_VERSION,gameValue,gameChecks,marketProbabilities} from './game-model.js';
export function freezeGame({analysis,quote,event,capturedAt,sourceCommit}){
 if(!(Date.parse(capturedAt)<Date.parse(event.startTime)))throw Error('Cannot capture game market after start');
 if(!analysis||analysis.model.trainingEnd>=event.date)throw Error('Invalid pregame training history');
 const checks=gameChecks(analysis,quote,event,Date.parse(capturedAt));
 return {id:JSON.stringify([event.id,quote.market,quote.side,quote.point]),kind:'game',eventId:event.id,nhlGameId:event.nhlGameId,date:event.date,startTime:event.startTime,homeTeam:event.homeTeam,awayTeam:event.awayTeam,market:quote.market,side:quote.side,line:quote.point,quote:{american:quote.american,decimal:quote.decimal,bookmaker:quote.bookmaker,bookmakerTitle:quote.bookmakerTitle,lastUpdate:quote.lastUpdate},capturedAt,sourceCommit,modelVersion:GAME_VERSION,modelInputs:analysis.model,probability:analysis.probability,baselineProbability:analysis.baseline,backtest:{games:analysis.test.games,brier:analysis.test.brier,baseline:analysis.test.baseline},estimatedValue:gameValue(analysis.probability,quote.decimal).ev,candidate:!checks.length,checks,archiveAt:analysis.archiveAt,trainingEnd:analysis.model.trainingEnd};
}
export function aggregateGames(records,onlyCandidates=false){
 const rows=records.filter(r=>!onlyCandidates||r.snapshot.candidate),graded=rows.filter(r=>['win','loss','push'].includes(r.result.state)),unique=new Map();
 for(const r of graded){const s=r.snapshot,key=JSON.stringify([s.eventId,s.market,s.market==='spreads'?(s.side==='Home'?s.line:-s.line):null]);unique.set(key,r)}
 let loss=0,baseline=0;const bins=Array.from({length:5},()=>({n:0,predicted:0,observed:0}));
 for(const {snapshot:s,result:r}of unique.values()){
  const score=p=>s.market==='h2h_3_way'?['home','draw','away'].reduce((n,k)=>n+(p.regulation[k]-Number(k===r.regulation))**2,0)/2:['win','loss','push'].reduce((n,k)=>n+(p[k]-Number(k===r.state))**2,0)/2;
  loss+=score(s.probability);baseline+=score(s.baselineProbability);
  const add=(probability,observed)=>{const b=bins[Math.min(4,Math.floor(probability*5))];b.n++;b.predicted+=probability;b.observed+=observed};
  if(s.market==='h2h_3_way'){for(const k of ['home','draw','away'])add(s.probability.regulation[k],Number(r.regulation===k))}
  else{const line=s.market==='spreads'?(s.side==='Home'?s.line:-s.line):null,canonical=marketProbabilities(s.modelInputs,s.market,'Home',line),margin=r.finalHome-r.finalAway+(s.market==='spreads'?line:0);add(canonical.win,Number(margin>0))}
 }
 const units=graded.reduce((n,r)=>n+r.result.units,0);return {predictions:rows.length,graded:graded.length,wins:graded.filter(r=>r.result.state==='win').length,losses:graded.filter(r=>r.result.state==='loss').length,pushes:graded.filter(r=>r.result.state==='push').length,voids:rows.filter(r=>r.result.state==='void').length,pending:rows.filter(r=>r.result.state==='pending').length,units,roi:graded.length?units/graded.length:null,uniqueTests:unique.size,brier:unique.size?loss/unique.size:null,baselineBrier:unique.size?baseline/unique.size:null,bins:bins.map(b=>({n:b.n,predicted:b.n?b.predicted/b.n:null,observed:b.n?b.observed/b.n:null}))};
}
