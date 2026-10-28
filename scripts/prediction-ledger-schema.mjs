// Portable, allowlisted paper-ledger projection; no network, credentials, or personal wagers.
const ledgerTime=value=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Timestamp required');return new Date(value).toISOString()};
const ledgerText=(value,pattern)=>{if(typeof value!=='string'||!pattern.test(value))throw Error('Invalid identity');return value};
const ledgerNumber=value=>{if(typeof value!=='number'||!Number.isFinite(value))throw Error('Finite number required');return value};
const ledgerDate=value=>{ledgerText(value,/^\d{4}-\d{2}-\d{2}$/);if(ledgerTime(value).slice(0,10)!==value)throw Error('Invalid date');return value};
const ledgerDistribution=(input,game)=>{
 const keys=game?['win','loss','push']:['over','under','push'];const result={};
 for(const key of keys){const value=ledgerNumber(input?.[key]);if(value<0||value>1)throw Error('Invalid probability');result[key]=value}
 if(Math.abs(Object.values(result).reduce((a,b)=>a+b,0)-1)>1e-6)throw Error('Probability mass required');
 if(game&&input.regulation){const values={};for(const key of ['home','draw','away']){values[key]=ledgerNumber(input.regulation[key]);if(values[key]<0||values[key]>1)throw Error('Invalid regulation probability')}if(Math.abs(Object.values(values).reduce((a,b)=>a+b,0)-1)>1e-6)throw Error('Regulation mass required');result.regulation=values}
 return result;
};
export function normalizeLedgerPrediction(s){
 const game=s?.kind==='game',market=game?s.market:'player_shots_on_goal';
 if(!['h2h','h2h_3_way','spreads','totals','player_shots_on_goal'].includes(market))throw Error('Unsupported ledger market');
 const side=ledgerText(s.side,market==='totals'||!game?/^(Over|Under)$/:market==='h2h_3_way'?/^(Home|Away|Draw)$/:/^(Home|Away)$/);
 const eventId=ledgerText(s.eventId,/^[a-f0-9]{32}$/),nhlGameId=ledgerText(String(s.nhlGameId),/^\d{10}$/),date=ledgerDate(s.date),capturedAt=ledgerTime(s.capturedAt),startTime=ledgerTime(s.startTime),trainingEnd=ledgerDate(s.trainingEnd);
 if(capturedAt>=startTime||trainingEnd>=date)throw Error('Pregame forecast and earlier training required');
 const line=['h2h','h2h_3_way'].includes(market)?null:ledgerNumber(s.line);if((market==='totals'||!game)&&line<0)throw Error('Invalid line');
 const playerId=game?null:ledgerText(String(s.playerId),/^\d{7}$/);
 const modelVersion=ledgerText(s.modelVersion,/^[a-z0-9-]{1,64}$/),sourceCommit=ledgerText(s.sourceCommit,/^[a-f0-9]{7,40}$/);
 const decimal=ledgerNumber(s.quote?.decimal);if(decimal<=1||decimal>10000)throw Error('Invalid price');
 const lastUpdate=ledgerTime(s.quote.lastUpdate);if(lastUpdate>capturedAt)throw Error('Future quote');
 const bookmaker=ledgerText(s.quote.bookmaker,/^[a-zA-Z0-9_-]{1,80}$/);
 if(typeof s.candidate!=='boolean'||!Array.isArray(s.checks)||s.checks.length>80||s.checks.some(x=>typeof x!=='string'||x.length>300))throw Error('Qualification checks required');
 const inputs={};for(const key of (game?['home','away','homeSample','awaySample','overtimeHome']:['mean','alpha','sample','base','recent','venue','opponent','iceTime','usesIceTime'])){const value=s.modelInputs?.[key];if(value!==undefined){if(key==='usesIceTime'){if(typeof value!=='boolean')throw Error('Invalid model flag');inputs[key]=value}else inputs[key]=ledgerNumber(value)}}
 if(game){if(!(inputs.home>0&&inputs.away>0&&inputs.overtimeHome>=0&&inputs.overtimeHome<=1))throw Error('Goal model inputs required');inputs.trainingEnd=trainingEnd}else if(!(inputs.mean>0&&inputs.alpha>=0&&inputs.sample>=20))throw Error('Count model inputs required');
 const probability=ledgerDistribution(s.probability,game),baselineProbability=ledgerDistribution(s.baselineProbability,game);
 return {id:JSON.stringify([eventId,market,playerId,side,line,modelVersion,capturedAt]),kind:game?'game':'prop',eventId,nhlGameId,date,startTime,playerId,market,side,line,quote:{decimal,bookmaker,lastUpdate},capturedAt,sourceCommit,modelVersion,probability,baselineProbability,modelInputs:inputs,...(s.trialId!==undefined?{trialId:ledgerText(s.trialId,/^[a-z0-9][a-z0-9-]{7,63}$/)}:{}),candidate:s.candidate,checks:[...s.checks],trainingEnd};
}
export function normalizeLedgerGrade(input,snapshot){
 const gradedAt=ledgerTime(input.gradedAt);if(gradedAt<snapshot.startTime)throw Error('Cannot grade before start');
 const state=ledgerText(input.result?.state,/^(win|loss|push|void|pending)$/);
 const result={state,units:state==='win'?snapshot.quote.decimal-1:state==='loss'?-1:0};
 for(const key of ['shots','finalHome','finalAway'])if(input.result[key]!==undefined){const value=input.result[key];if(!Number.isSafeInteger(value)||value<0)throw Error('Invalid official statistic');result[key]=value}
 if(input.result.regulation!==undefined)result.regulation=ledgerText(input.result.regulation,/^(home|away|draw)$/);
 return {predictionId:ledgerText(input.predictionId,/^[a-f0-9]{64}$/),previousGradeDigest:input.previousGradeDigest==null?null:ledgerText(input.previousGradeDigest,/^[a-f0-9]{64}$/),gradedAt,result};
}
