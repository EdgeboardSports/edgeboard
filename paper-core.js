import {quoteValue,VERSION,validGames} from './shots-model.js';
export function researchChecks(analysis,quote,event,now=Date.now()){
 const r=analysis.result;if(!r)return ['Fewer than 20 training games'];
 const value=quoteValue(r.prediction,quote.side,quote.decimal),sensitivity=Math.min(quoteValue(r.low,quote.side,quote.decimal).ev,quoteValue(r.high,quote.side,quote.decimal).ev),reasons=[];
 if(r.test.games<30)reasons.push('Fewer than 30 test games');
 if(r.test.brier===null||r.test.brier>r.test.baseline)reasons.push('Does not beat baseline');
 if(value.ev<=0)reasons.push('Non-positive estimated value');
 if(sensitivity<=0)reasons.push('Fails sensitivity check');
 const age=now-Date.parse(quote.lastUpdate);if(!Number.isFinite(age)||age>15*60000||age< -60000)reasons.push('Quote is stale or undated');
 if(!(Date.parse(event.commenceTime)>now))reasons.push('Game already started');
 if(!analysis.context.venue)reasons.push('Team/venue unverified');
 if(analysis.context.rosterVerified!==true)reasons.push('Current NHL roster unverified');
 const rosterAge=now-Date.parse(analysis.context.rosterCheckedAt);
 if(!Number.isFinite(rosterAge)||rosterAge>10*60000||rosterAge< -60000)reasons.push('Roster check stale or unavailable');
 if(analysis.context.research){reasons.push(...analysis.context.research.blocks);const age=now-Date.parse(analysis.context.research.checkedAt);if(!Number.isFinite(age)||age>10*60000||age< -60000)reasons.push('Game-day research stale or unavailable')}
 return [...new Set(reasons)];
}
export function baselineProbability(games,line){
 const sample=validGames(games).slice(-40),counts={over:.5,under:.5,push:Number.isInteger(line)?.5:0};
 for(const g of sample){const v=Number(g.shots);counts[v>line?'over':v<line?'under':'push']++}
 const n=sample.length+1+(Number.isInteger(line)?.5:0);return Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/n]));
}
export function freezePrediction({analysis,quote,event,player,capturedAt,sourceCommit,games}){
 if(!(Date.parse(capturedAt)<Date.parse(event.commenceTime)))throw Error('Cannot capture after start');
 if(!analysis.result)throw Error('Insufficient model history');
 if(validGames(games).some(g=>(g.gameDate||g.date)>=event.date))throw Error('Training includes target or future dates');
 const checks=researchChecks(analysis,quote,event,Date.parse(capturedAt)),r=analysis.result;
 return {id:JSON.stringify([event.id,player.id,quote.point,quote.side]),eventId:event.id,nhlGameId:event.nhlGameId,date:event.date,startTime:event.commenceTime,homeTeam:event.homeTeam,awayTeam:event.awayTeam,playerId:player.id,player:quote.player,line:quote.point,side:quote.side,quote:{american:quote.american,decimal:quote.decimal,bookmaker:quote.bookmaker,bookmakerTitle:quote.bookmakerTitle,lastUpdate:quote.lastUpdate},capturedAt,sourceCommit,modelVersion:VERSION,probability:r.prediction,baselineProbability:baselineProbability(games,quote.point),modelInputs:r.model,playerVerification:{rosterVerified:analysis.context.rosterVerified===true,rosterCheckedAt:analysis.context.rosterCheckedAt||null,lineupConfirmed:false},research:analysis.context.research||null,backtest:{games:r.test.games,brier:r.test.brier,baseline:r.test.baseline},estimatedValue:quoteValue(r.prediction,quote.side,quote.decimal).ev,candidate:checks.length===0,checks,trainingEnd:validGames(games).at(-1)?.gameDate||null};
}
export function gradePrediction(snapshot,nhlGame,playerGames,now=Date.now()){
 if(!nhlGame||!['OFF','FINAL'].includes(nhlGame.gameState))return {state:'pending'};
 const matches=playerGames.filter(g=>String(g.gameId)===String(snapshot.nhlGameId));
 if(matches.length!==1){
  return !matches.length&&now-Date.parse(snapshot.startTime)>24*3600000?{state:'void',reason:'No player appearance in official game log 24 hours after final game start',units:0}:{state:'pending',reason:'Waiting for player game log'};
 }
 const value=matches[0].shots;if(value===null||value===undefined||value===''||!Number.isInteger(Number(value))||Number(value)<0)return {state:'pending',reason:'Waiting for valid shot count'};
 const shots=Number(value),state=shots===snapshot.line?'push':(snapshot.side==='Over'?shots>snapshot.line:shots<snapshot.line)?'win':'loss';
 return {state,shots,units:state==='win'?snapshot.quote.decimal-1:state==='loss'?-1:0};
}
export function aggregate(records,onlyCandidates=false){
 const rows=records.filter(r=>!onlyCandidates||r.snapshot.candidate),graded=rows.filter(r=>['win','loss','push'].includes(r.result.state));
 const unique=new Map();for(const r of graded)unique.set(JSON.stringify([r.snapshot.eventId,r.snapshot.playerId,r.snapshot.line]),r);
 let loss=0,baselineLoss=0;const bins=Array.from({length:5},()=>({n:0,predicted:0,observed:0}));
 for(const {snapshot:s,result:r}of unique.values()){
  const outcome=r.shots>s.line?'over':r.shots<s.line?'under':'push';
  const brier=p=>['over','under','push'].reduce((n,k)=>n+(p[k]-Number(k===outcome))**2,0)/2;
  loss+=brier(s.probability);baselineLoss+=brier(s.baselineProbability);
  const b=bins[Math.min(4,Math.floor(s.probability.over*5))];b.n++;b.predicted+=s.probability.over;b.observed+=Number(outcome==='over');
 }
 const units=graded.reduce((n,r)=>n+r.result.units,0);
 return {independentGames:new Set(rows.map(r=>r.snapshot.eventId)).size,gradedGames:new Set(graded.map(r=>r.snapshot.eventId)).size,predictions:rows.length,graded:graded.length,wins:graded.filter(r=>r.result.state==='win').length,losses:graded.filter(r=>r.result.state==='loss').length,pushes:graded.filter(r=>r.result.state==='push').length,voids:rows.filter(r=>r.result.state==='void').length,pending:rows.filter(r=>r.result.state==='pending').length,units,roi:graded.length?units/graded.length:null,uniqueTests:unique.size,brier:unique.size?loss/unique.size:null,baselineBrier:unique.size?baselineLoss/unique.size:null,bins:bins.map(b=>({n:b.n,predicted:b.n?b.predicted/b.n:null,observed:b.n?b.observed/b.n:null}))};
}


