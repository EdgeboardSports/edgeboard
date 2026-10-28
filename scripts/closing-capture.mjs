import {cleanName} from '../prop-history.js';
// One durable attempt per event/market group. No added markets, historical backfill, or wagers.
export async function captureClosingPrices(ledger,client,{closingStore,clock=()=>Date.now()}={}){
 const report={attemptedGroups:0,saved:0,missing:0,notes:[],errors:[]};
 const groups=new Map();
 for(const event of ledger.events||[])for(const record of [...(event.records||[]),...(event.gameRecords||[])]){const s=record.snapshot,lead=Date.parse(s.startTime)-clock();if(!record.ledgerId||lead<=0||lead>15*60000||!['player_shots_on_goal','h2h','spreads','h2h_3_way'].includes(s.market||'player_shots_on_goal'))continue;const phase=(s.market||'player_shots_on_goal')==='player_shots_on_goal'?'shots':'game',key=s.eventId+':'+phase;if(!groups.has(key))groups.set(key,{phase,eventId:s.eventId,records:[]});groups.get(key).records.push(record)}
 if(!groups.size||!closingStore)return report;
 try{if(!(await closingStore.status()).writesEnabled){report.notes.push('Closing capture paused by private storage gate');return report}}catch{report.errors.push('Closing storage readiness unavailable');return report}
 const cache=new Map(),get=path=>{if(!cache.has(path))cache.set(path,client(path));return cache.get(path)};
 for(const group of groups.values())try{
  let records=group.records;const names=new Map(),target=records[0].snapshot,schedule=await get('/api/nhl-schedule?date='+target.date),game=(schedule.games||[]).find(g=>String(g.id)===String(target.nhlGameId));
  if(!game||!['FUT','PRE'].includes(game.gameState)||!Number.isFinite(Date.parse(game.startTimeUTC))||Date.parse(game.startTimeUTC)<=clock())throw Error('Upcoming NHL identity unavailable for closing quotes');
  if(group.phase==='shots'){
   const ids=[...new Set(records.map(r=>String(r.snapshot.playerId)))];const counts=new Map();
   for(const id of ids){const profile=await get('/api/nhl-player-profile?id='+id);if(String(profile.id)!==id||typeof profile.name!=='string'||!profile.name.trim()||![game.homeTeam?.abbrev,game.awayTeam?.abbrev].includes(profile.team))continue;const name=cleanName(profile.name);names.set(id,name);counts.set(name,(counts.get(name)||0)+1)}
   records=records.filter(r=>names.has(String(r.snapshot.playerId))&&counts.get(names.get(String(r.snapshot.playerId)))===1);if(!records.length){report.notes.push('No unambiguous matched players for closing quotes');continue}
  }
  const first=records[0],s=first.snapshot,now=clock(),lead=Date.parse(s.startTime)-now;if(lead<=0||lead>15*60000)continue;
  const budget=await client('/api/budget-status'),cost=group.phase==='shots'?1:3;if(!Number.isSafeInteger(budget.availableCredits)||budget.availableCredits<cost){report.notes.push('Closing request skipped: insufficient protected budget');continue}
  const claim=await closingStore.claim({predictionId:first.ledgerId,eventId:s.eventId,phase:group.phase,requestedAt:new Date(now).toISOString()},s);if(!claim.claimed){report.notes.push('Closing group already attempted');continue}report.attemptedGroups++;
  if(clock()>=Math.min(Date.parse(s.startTime),Date.parse(game.startTimeUTC))){report.notes.push('Closing request skipped: verified start reached during claim');continue}
  const path=group.phase==='shots'?'/api/nhl-props?event='+s.eventId+'&market=player_shots_on_goal':'/api/nhl-game-odds?event='+s.eventId;
  const feed=await client(path),observed=clock();if(feed.status!=='live'||feed.eventId!==s.eventId||!Array.isArray(feed.odds)||!Number.isFinite(Date.parse(feed.commenceTime))||observed>=Math.min(Date.parse(s.startTime),Date.parse(feed.commenceTime),Date.parse(game.startTimeUTC)))throw Error('Verified pregame closing feed unavailable');
  for(const record of records){const snapshot=record.snapshot,market=snapshot.market||'player_shots_on_goal';const candidates=feed.odds.filter(q=>q.bookmaker===snapshot.quote.bookmaker&&q.side===snapshot.side&&(q.point??null)===(snapshot.line??null)&&(group.phase==='shots'?(q.market===undefined||q.market===market)&&cleanName(q.player||'')===names.get(String(snapshot.playerId)):q.market===market));const unique=[...new Map(candidates.map(q=>[JSON.stringify([q.decimal,q.lastUpdate]),q])).values()];if(unique.length!==1){report.missing++;continue}const quote=unique[0];
   try{await closingStore.append({predictionId:record.ledgerId,eventId:snapshot.eventId,market,side:snapshot.side,playerId:snapshot.playerId??null,line:snapshot.line??null,bookmaker:quote.bookmaker,decimal:quote.decimal,observedAt:new Date(observed).toISOString(),quoteAt:quote.lastUpdate,source:closingStore.synthetic?'synthetic-fixture':'the-odds-api'},snapshot);report.saved++}catch{report.missing++}
  }
 }catch(error){report.errors.push('Closing capture stopped for a group; no verified quote saved')}
 return report;
}
