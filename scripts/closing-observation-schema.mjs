const closingTime=value=>{if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw Error('Closing timestamp required');return new Date(value).toISOString()};
export function normalizeClosingAttempt(input,snapshot){
 if(!/^[a-f0-9]{64}$/.test(input.predictionId||'')||input.eventId!==snapshot.eventId||!['shots','game'].includes(input.phase)||input.phase!==((snapshot.market||'player_shots_on_goal')==='player_shots_on_goal'?'shots':'game'))throw Error('Matched closing attempt required');
 const requestedAt=closingTime(input.requestedAt),start=Date.parse(snapshot.startTime),time=Date.parse(requestedAt);
 if(time<Date.parse(snapshot.capturedAt)||time>=start||start-time>15*60000)throw Error('Final 15 pregame minutes required');
 return {predictionId:input.predictionId,eventId:input.eventId,phase:input.phase,requestedAt};
}
export function normalizeClosingObservation(input,snapshot,synthetic=false){
 if(!/^[a-f0-9]{64}$/.test(input.predictionId||'')||input.eventId!==snapshot.eventId||input.market!==(snapshot.market||'player_shots_on_goal')||input.side!==snapshot.side||(input.playerId??null)!==(snapshot.playerId??null)||(input.line??null)!==(snapshot.line??null)||input.bookmaker!==snapshot.quote.bookmaker)throw Error('Same event, player, market, side, line and book required');
 const observedAt=closingTime(input.observedAt),quoteAt=closingTime(input.quoteAt),observed=Date.parse(observedAt),quote=Date.parse(quoteAt),start=Date.parse(snapshot.startTime);
 if(observed<Date.parse(snapshot.capturedAt)||observed>=start||start-observed>15*60000||quote>observed||observed-quote>15*60000)throw Error('Fresh final-window pregame quote required');
 if(typeof input.decimal!=='number'||!Number.isFinite(input.decimal)||input.decimal<=1||input.decimal>10000)throw Error('Valid closing price required');
 if(input.source!==(synthetic?'synthetic-fixture':'the-odds-api'))throw Error('Closing source required');
 return {predictionId:input.predictionId,eventId:input.eventId,market:input.market,side:input.side,playerId:input.playerId??null,line:input.line??null,bookmaker:input.bookmaker,decimal:input.decimal,observedAt,quoteAt,source:input.source};
}
