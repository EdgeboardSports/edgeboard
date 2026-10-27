import {loadGameDay} from './game-day.js';
import {teamContext,playerResearch,gameResearch} from './research-context.js';
import {seasonFor,completedBefore,cleanName,verifyRoster} from './prop-history.js';
import {evaluate,quoteValue,VERSION} from './shots-model.js';
import {researchChecks} from './paper-core.js';
import {analyzeGame,gameChecks,gameValue,GAME_VERSION} from './game-model.js';
export const marketNames={player_shots_on_goal:'Shots on goal',h2h:'Moneyline · OT/SO',spreads:'Puck line · OT/SO',h2h_3_way:'Three-way · regulation'};
export const day=t=>new Date(t).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
export function bestQuotes(rows,book='',now=Date.now()){
 const groups=new Map();for(const r of rows){if(!Number.isFinite(r.quote?.decimal)||r.quote.decimal<=1)continue;if(book&&r.quote.bookmaker!==book)continue;const q=r.quote,key=JSON.stringify([r.kind,r.event.eventId||r.event.id,q.market,q.player||'',q.side,q.point]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 const fresh=r=>{const age=now-Date.parse(r.quote.lastUpdate);return Number.isFinite(age)&&age<=900000&&age>=-60000};
 return [...groups.values()].map(g=>(g.some(fresh)?g.filter(fresh):g).sort((a,b)=>b.quote.decimal-a.quote.decimal)[0]);
}
export function ranked(rows,{kind='props',book='',includeFailed=false,now=Date.now()}={}){
 return bestQuotes(rows.filter(r=>kind==='all'||r.kind===kind),book,now).map(r=>({...r,reasons:r.kind==='props'?researchChecks(r.analysis,r.quote,r.event,now):gameChecks(r.analysis,r.quote,r.event,now)})).filter(r=>Number.isFinite(r.value?.ev)&&(includeFailed||!r.reasons.length)).sort((a,b)=>Number(a.reasons.length>0)-Number(b.reasons.length>0)||b.value.ev-a.value.ev||a.label.localeCompare(b.label));
}
// Recompute decisions from model probabilities and the selected quote; never trust a cached EV.
export function decisionBoard(rows,{kind='all',book='',includeFailed=false,collapseAlternatives=true,limit=10,now=Date.now()}={}){
 if(!['all','props','games'].includes(kind)||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid board options');
 const evaluated=[];
 for(const row of rows){
  if(!['props','games'].includes(row.kind))continue;
  const q=row.quote;if(!Number.isFinite(q?.decimal)||q.decimal<=1)continue;
  try{
   const p=row.kind==='props'?row.analysis.result.prediction:row.analysis.probability;
   const value=row.kind==='props'?quoteValue(p,q.side,q.decimal):gameValue(p,q.decimal);
   const win=row.kind==='props'?(q.side==='Over'?p.over:p.under):p.win,loss=row.kind==='props'?(q.side==='Over'?p.under:p.over):p.loss,push=p.push;
   if([win,loss,push].some(n=>!Number.isFinite(n)||n<0||n>1)||Math.abs(win+loss+push-1)>1e-6)continue;
   const worstEv=row.kind==='props'?Math.min(...['low','high'].map(k=>quoteValue(row.analysis.result[k],q.side,q.decimal).ev)):row.analysis.worstValue;
   evaluated.push({...row,value,probability:{win,loss,push},decision:{worstEv:Number.isFinite(worstEv)?worstEv:null,fairDecimal:win>0?1+loss/win:null}});
  }catch{continue}
 }
 const all=ranked(evaluated,{kind,book,includeFailed:true,now}),eligible=all.filter(r=>!r.reasons.length),pool=includeFailed?all:eligible,seen=new Set(),retained=[];
 for(const row of pool){
  const key=JSON.stringify([row.event.eventId||row.event.id,row.kind,row.quote.market,row.player?.id||cleanName(row.quote.player||'')]);
  if(collapseAlternatives&&seen.has(key))continue;
  seen.add(key);retained.push(row);
 }
 const selected=retained.slice(0,limit),counts=new Map();
 for(const row of selected){const id=row.event.eventId||row.event.id;counts.set(id,(counts.get(id)||0)+1)}
 return {rows:selected.map(row=>({...row,decision:{...row.decision,sameEventSelections:counts.get(row.event.eventId||row.event.id)}})),qualifying:eligible.length,modeled:all.length,alternativesHidden:pool.length-retained.length,omittedInvalid:rows.length-evaluated.length,independentEvents:counts.size};
}
// Margin removal is only defined for a complete, fresh, same-book outcome set.
export function marketComparison(row,rows,now=Date.now()){
 const q=row.quote,event=row.event.eventId||row.event.id,expected=q.market==='h2h_3_way'?['Home','Away','Draw']:q.market==='player_shots_on_goal'?['Over','Under']:['Home','Away'];
 const peers=rows.filter(r=>{const p=r.quote,age=now-Date.parse(p.lastUpdate);return Number.isFinite(p.decimal)&&p.decimal>1&&(r.event.eventId||r.event.id)===event&&p.market===q.market&&p.bookmaker===q.bookmaker&&(p.player||'')===(q.player||'')&&Number.isFinite(age)&&age>=-60000&&age<=900000&&(q.market==='spreads'?p.point===(p.side===q.side?q.point:-q.point):p.point===q.point)});
 const sides=new Map();for(const r of peers){if(sides.has(r.quote.side))return {implied:1/q.decimal,noVig:null,edge:null,reason:'Ambiguous outcome set'};sides.set(r.quote.side,r.quote)}
 if(sides.size!==expected.length||!expected.every(side=>sides.has(side)))return {implied:1/q.decimal,noVig:null,edge:null,reason:'Complete fresh same-book market unavailable'};
 const sum=[...sides.values()].reduce((n,p)=>n+1/p.decimal,0),noVig=(1/q.decimal)/sum;
 return {implied:1/q.decimal,noVig,overround:sum-1,edge:row.value.conditional==null?null:row.value.conditional-noVig,method:'proportional; conditional on no push'};
}
export function createScanner(read){
 const cache=new Map();const memo=(url)=>{const ttl=(url.includes('nhl-schedule')||url.includes('nhl-game-context'))?60000:300000,old=cache.get(url);if(!old||Date.now()-old.at>ttl){const entry={at:Date.now(),promise:read(url).catch(e=>{cache.delete(url);throw e})};cache.set(url,entry)}return cache.get(url).promise};
 async function context(feed,archive){const date=day(feed.commenceTime),event={id:feed.eventId,eventId:feed.eventId,date,commenceTime:feed.commenceTime,startTime:feed.commenceTime,homeTeam:feed.homeTeam,awayTeam:feed.awayTeam,verified:false};
 const find=n=>{const m=Object.entries(archive?.teamNames||{}).filter(([c,t])=>cleanName(t)===cleanName(n));return m.length===1?m[0][0]:null};event.homeAbbrev=find(feed.homeTeam);event.awayAbbrev=find(feed.awayTeam);
 try{const d=await memo('/api/nhl-schedule?date='+date),name=t=>t?.name?.default||t?.commonName?.default,match=(d.games||[]).filter(g=>name(g.homeTeam)&&name(g.awayTeam)&&cleanName(feed.homeTeam).endsWith(cleanName(name(g.homeTeam)))&&cleanName(feed.awayTeam).endsWith(cleanName(name(g.awayTeam))));if(match.length===1){const g=match[0];event.nhlGameId=g.id;event.homeAbbrev=g.homeTeam.abbrev;event.awayAbbrev=g.awayTeam.abbrev;event.startTime=event.commenceTime=new Date(Math.min(Date.parse(feed.commenceTime),Date.parse(g.startTimeUTC||feed.commenceTime))).toISOString();event.verified=['FUT','PRE'].includes(g.gameState)&&g.gameType===2}}
 catch{}const [homeResearch,awayResearch]=await Promise.all([teamContext(memo,event.homeAbbrev,date),teamContext(memo,event.awayAbbrev,date)]);event.teamResearch={home:homeResearch,away:awayResearch};event.research=gameResearch(event,homeResearch,awayResearch);event.gameDay=await loadGameDay(memo,event);return event}
 async function playerFor(name,event){const found=await memo('/api/nhl-player-search?q='+encodeURIComponent(name)),matches=(found.players||[]).filter(p=>cleanName(p.name)===cleanName(name));if(matches.length!==1)throw Error('Player identity unavailable');const player=matches[0],season=seasonFor(event.commenceTime),prior=String(Number(season.slice(0,4))-1)+season.slice(0,4);const log=await memo('/api/nhl-game-log?'+new URLSearchParams({playerId:player.id,season}));if(!Array.isArray(log.games))throw Error('Player history unavailable');let previous={games:[]};try{previous=await memo('/api/nhl-game-log?'+new URLSearchParams({playerId:player.id,season:prior}))}catch{}const venue=event.verified?(event.homeAbbrev===player.team?'H':event.awayAbbrev===player.team?'R':null):null;const ctx={venue,opponent:venue==='H'?event.awayAbbrev:venue==='R'?event.homeAbbrev:null};Object.assign(ctx,await verifyRoster(memo,player,ctx));const games=completedBefore([...log.games,...previous.games||[]],event.date),own=venue==='H'?event.teamResearch?.home:venue==='R'?event.teamResearch?.away:null,opponent=venue==='H'?event.teamResearch?.away:venue==='R'?event.teamResearch?.home:null;ctx.playerId=player.id;ctx.research=playerResearch(player,games,event,own,opponent);return {player,season,games,context:ctx}}
 return async function scan(selected,{props=true,games=true,onProgress=()=>{}}={}){const rows=[],issues=[],feeds=[];let archive=null;if(games)try{archive=await memo('/api/game-archive')}catch{issues.push('Team archive unavailable; game bets cannot qualify.')}
 for(const selectedEvent of selected){if(!(Date.parse(selectedEvent.commenceTime)>Date.now())){issues.push(selectedEvent.awayTeam+' @ '+selectedEvent.homeTeam+': already started; skipped.');continue}
 onProgress('Loading '+selectedEvent.awayTeam+' @ '+selectedEvent.homeTeam+'…');const requests=[];if(props)requests.push(['props','/api/nhl-props?'+new URLSearchParams({event:selectedEvent.id,market:'player_shots_on_goal'})]);if(games)requests.push(['games','/api/nhl-game-odds?event='+selectedEvent.id]);
 for(const [kind,url]of requests){try{const feed=await read(url);if(!Array.isArray(feed.odds))throw Error('Quotes unavailable');if(kind==='props')feed.odds=feed.odds.map(q=>({...q,market:'player_shots_on_goal'}));feeds.push({kind,eventId:selectedEvent.id,fetchedAt:feed.fetchedAt,count:feed.odds.length});const e=await context(feed,archive);if(!feed.odds.length)issues.push(feed.awayTeam+' @ '+feed.homeTeam+': no '+kind+' quotes offered.');
 if(kind==='games'){const analyses=new Map();for(const q of feed.odds){if(!marketNames[q.market])continue;const key=JSON.stringify([q.market,q.side,q.point,q.decimal]);let a=analyses.get(key);if(!analyses.has(key)){a=archive&&e.homeAbbrev&&e.awayAbbrev?analyzeGame(archive,e,q):null;analyses.set(key,a)}if(!a)continue;a.research=e.research;rows.push({kind,quote:q,event:e,analysis:a,value:gameValue(a.probability,q.decimal),probability:a.probability,label:(q.side==='Home'?e.homeTeam:q.side==='Away'?e.awayTeam:'Regulation draw')+(q.point==null?'':' '+(q.point>0?'+':'')+q.point),version:GAME_VERSION})}if(!analyses.size||![...analyses.values()].some(Boolean))issues.push(feed.awayTeam+' @ '+feed.homeTeam+': team model unavailable.')}
 else{const names=[...new Set(feed.odds.map(q=>q.player))];for(let start=0;start<names.length;start+=3){await Promise.all(names.slice(start,start+3).map(async name=>{try{const record=await playerFor(name,e),models=new Map();for(const q of feed.odds.filter(q=>q.player===name)){if(!models.has(q.point))models.set(q.point,evaluate(record.games,Number(q.point),record.context));const result=models.get(q.point);if(!result)continue;rows.push({kind,quote:q,event:e,analysis:{result,context:record.context},value:quoteValue(result.prediction,q.side,q.decimal),probability:{win:q.side==='Over'?result.prediction.over:result.prediction.under,push:result.prediction.push},player:record.player,season:record.season,label:name+' · '+q.side+' '+q.point,version:VERSION})}if(![...models.values()].some(Boolean))issues.push(name+': insufficient history.')}catch(error){issues.push(name+': player history unavailable ('+error.message+').')}}));onProgress('Testing shots props · '+Math.min(start+3,names.length)+'/'+names.length+' players · '+e.awayTeam+' @ '+e.homeTeam)}}
 }catch{issues.push(selectedEvent.awayTeam+' @ '+selectedEvent.homeTeam+': '+kind+' feed unavailable.')}}}
 return {rows,issues,feeds,scannedAt:new Date().toISOString()};};
}


