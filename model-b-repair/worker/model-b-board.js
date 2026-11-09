import {NHL_TEAM_CODES} from './matchup-inputs.js';
import {buildTeamBaseline,poissonScoreGrid,EXPERIMENTAL_MODEL_VERSION} from './experimental-model.js';
import {forwardAppend,forwardHash,loadForwardRecords} from './forward-testing.js';
import {forwardDate,forwardGrade} from './forward-core.js';
import {resolvePuckFinal} from './puckapi-grading.js';
async function b4Verified(row){if(!row)return null;if(await forwardHash(row.payload)!==row.digest)throw Error('Evidence integrity');return {...row,value:JSON.parse(row.payload)}}
async function b4Latest(DB,namespace){return b4Verified(await DB.prepare('SELECT id,payload,digest,captured_at FROM collector_evidence WHERE namespace=? ORDER BY captured_at DESC LIMIT 1').bind(namespace).first())}
async function b4LoadRows(DB,namespace,id){const rows=(await DB.prepare('SELECT id,payload,digest,captured_at FROM collector_evidence WHERE namespace=? AND event_id=? ORDER BY captured_at,id LIMIT 1001').bind(namespace,id).all()).results;if(rows.length>1000)throw Error('Trial record limit');return Promise.all(rows.map(b4Verified))}
export async function modelBBoard(DB,rules,now){
 const statsRow=await b4Latest(DB,'forward-research-inputs'),oddsRow=await b4Latest(DB,'free-odds-cache'),puckRow=await b4Latest(DB,'puckapi-v1-receipts'),global=[];
 if([statsRow,oddsRow,puckRow].some(r=>r&&(!Number.isFinite(Date.parse(r.captured_at))||Date.parse(r.captured_at)>now)))global.push('source_receipt_after_evaluation');
 const stats=statsRow?.value.stats,audit=statsRow?.value.audit,odds=oddsRow?.value,puck=puckRow?.value.snapshot;
 if(!stats||!audit||Object.keys(audit.teams||{}).length!==32||!Number.isFinite(Date.parse(stats.teams?.downloadedAt))||!(/^[a-f0-9]{64}$/).test(stats.teams?.sourceSha256||'')||audit.summarySha256!==stats.teams?.sourceSha256||now-Date.parse(stats.teams?.downloadedAt)>48*3600000||Date.parse(stats.teams?.downloadedAt)>now)global.push('verified_fresh_team_inputs_required');
 if(!puck||!Array.isArray(puck.games)||!Number.isFinite(Date.parse(puck.retrievedAt))||now-Date.parse(puck.retrievedAt)>30*3600000||Date.parse(puck.retrievedAt)>now||await forwardHash(JSON.stringify(puck))!==puckRow?.value.upstreamDigest)global.push('verified_recent_puckapi_snapshot_required');
 if(!odds||!Array.isArray(odds.events)||!Number.isFinite(Date.parse(odds.fetchedAt))||!Number.isSafeInteger(odds.providerRemainingCredits)||odds.providerRemainingCredits<103||now-Date.parse(odds.fetchedAt)>24*3600000||Date.parse(odds.fetchedAt)>now)global.push('verified_odds_and_budget_required');
 if(rules?.book!=='draftkings'||rules.market!=='h2h'||rules.status!=='documented'||!Number.isFinite(Date.parse(rules.expiresAt))||!Number.isFinite(Date.parse(rules.reviewedAt))||Date.parse(rules.expiresAt)<=now||Date.parse(rules.reviewedAt)>now)global.push('current_documented_moneyline_rules_required');
 let baseline=null;try{if(stats)baseline=buildTeamBaseline(stats)}catch{global.push('complete_team_model_inputs_required')}
 if(odds?.events?.length===0&&(puck?.games||[]).some(g=>['FUT','PRE'].includes(g.gameState)&&Date.parse(g.sourceStartTime)>now&&Date.parse(g.sourceStartTime)<=now+24*3600000))global.push('upcoming_games_but_no_available_quotes');
 const evaluations=[];
 for(const event of odds?.events||[]){
  const holds=[...global],hc=NHL_TEAM_CODES[event.home],ac=NHL_TEAM_CODES[event.away],priceStart=Date.parse(event.startAt),date=Number.isFinite(priceStart)?forwardDate(priceStart):null;
  const matches=(puck?.games||[]).filter(g=>g.homeTeam===hc&&g.awayTeam===ac&&g.gameDate===date),g=matches.length===1?matches[0]:null,stamp=g?.sourceStartTime;
  const sourceStart=typeof stamp==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(stamp)?Date.parse(stamp):NaN,start=Math.min(priceStart,sourceStart);
  if(!g||!/^202602\d{4}$/.test(g.id)||g.gameType!=='regular'||!['FUT','PRE'].includes(g.gameState)||!Number.isFinite(sourceStart)||(Number.isFinite(sourceStart)&&forwardDate(sourceStart)!==g?.gameDate)||Math.abs(sourceStart-priceStart)>15*60000||!Number.isFinite(start)||start<=now+60000||start>now+24*3600000)holds.push('unique_verified_pregame_event_required');
  for(const c of [hc,ac]){const cut=audit?.teams?.[c],t=stats?.teams?.records?.find(x=>x.team===c),age=cut?(Date.parse(forwardDate(now))-Date.parse(cut.lastIncludedGameDate))/86400000:NaN;
   if(!t||!cut?.reconciled||cut.games!==t.situations.all.gamesPlayed||t.situations.all.gamesPlayed<5||cut.lastIncludedGameDate>=date||!Number.isFinite(age)||age<0||age>3)holds.push('dated_team_cutoff_required:'+c);
   const latest=(puck?.games||[]).filter(x=>['OFF','FINAL'].includes(x.gameState)&&[x.homeTeam,x.awayTeam].includes(c)).map(x=>x.gameDate).sort().at(-1);if(latest&&cut&&latest>cut.lastIncludedGameDate)holds.push('completed_game_missing_from_stats:'+c);
  }
  const book=event.books?.find(b=>b.key==='draftkings'),market=book?.markets?.find(m=>m.key==='h2h');
  if(!market||market.outcomes.length!==2||new Set(market.outcomes.map(x=>x.name)).size!==2||!market.outcomes.every(x=>[event.home,event.away].includes(x.name)))holds.push('draftkings_two_way_quote_required');
  const qt=Date.parse(market?.updatedAt);if(!Number.isFinite(qt)||qt>now||now-qt>15*60000||qt>=start)holds.push('fresh_pregame_quote_required');
  let model=null,homeProbability=null,scenarioHome=[];
  if(baseline?.teams[hc]&&baseline.teams[ac]){const h=baseline.teams[hc],a=baseline.teams[ac],hl=Math.sqrt(h.attack*a.defense),al=Math.sqrt(a.attack*h.defense),grid=poissonScoreGrid(hl,al);homeProbability=grid.regulation.home+grid.regulation.draw/2;
   model={homeLambda:hl,awayLambda:al,priorGames:10,overtimeHome:.5,homeTeam:h,awayTeam:a,homeCutoff:audit.teams[hc],awayCutoff:audit.teams[ac]};
   for(const hr of [.85,1.15])for(const ar of [.85,1.15]){const q=poissonScoreGrid(hl*hr,al*ar);for(const ot of [.4,.6])scenarioHome.push(q.regulation.home+q.regulation.draw*ot);}
  }else holds.push('model_inputs_unavailable');
  for(const q of market?.outcomes||[]){const side=q.name===event.home?'home':'away',decimal=q.price>0?1+q.price/100:1+100/-q.price,p=homeProbability===null?null:side==='home'?homeProbability:1-homeProbability,implied=1/decimal,edge=p===null?null:p-implied,ev=p===null?null:p*decimal-1,worst=p===null?null:Math.min(...scenarioHome.map(hp=>(side==='home'?hp:1-hp)*decimal-1));
   const reasons=[...holds];if(!Number.isInteger(q.price)||!Number.isFinite(decimal)||decimal<=1||Math.abs(q.price)<100)reasons.push('valid_price_required');if(!(edge>=.02&&ev>=.03&&worst>0))reasons.push('no_qualifying_scenario_robust_value');
   evaluations.push({eventId:event.id,sourceGameId:g?.id||null,home:event.home,away:event.away,date,startAt:Number.isFinite(start)?new Date(start).toISOString():null,priceStartAt:event.startAt,sourceStartAt:Number.isFinite(sourceStart)?new Date(sourceStart).toISOString():null,market:'h2h',selection:side,book:'draftkings',american:q.price,decimal,quoteAt:market.updatedAt,modelProbability:p,bookImpliedProbability:implied,edge,expectedReturn:ev,conservativeExpectedReturn:worst,strengthScore:worst===null?null:100*worst,confidence:'experimental',modelInputs:model,holds:[...new Set(reasons)],qualified:reasons.length===0});
  }
  if(!market)evaluations.push({eventId:event.id,date,sourceGameId:g?.id||null,startAt:Number.isFinite(start)?new Date(start).toISOString():null,home:event.home,away:event.away,market:'h2h',qualified:false,holds:[...new Set(holds)]});
 }
 // Walk the verified schedule as well as the price feed. Unpriced games remain explicit.
 for(const g of puck?.games||[]){if(g.gameDate!==forwardDate(now)||g.gameType!=='regular'||!['FUT','PRE'].includes(g.gameState)||evaluations.some(e=>e.sourceGameId===g.id))continue;
 const home=Object.keys(NHL_TEAM_CODES).find(n=>NHL_TEAM_CODES[n]===g.homeTeam),away=Object.keys(NHL_TEAM_CODES).find(n=>NHL_TEAM_CODES[n]===g.awayTeam);
 evaluations.push({eventId:'unpriced:'+g.id,sourceGameId:g.id,home,away,date:g.gameDate,startAt:g.sourceStartTime,market:'h2h',qualified:false,holds:[...global,'verified_two_way_quote_unavailable']});}
 return {checkedAt:new Date(now).toISOString(),globalHolds:[...new Set(global)],evaluations,sources:{stats:statsRow?.id||null,statsDigest:statsRow?.digest||null,odds:oddsRow?.id||null,oddsDigest:oddsRow?.digest||null,puck:puckRow?.id||null,puckDigest:puckRow?.digest||null},budgetRemainingAtOddsCapture:odds?.providerRemainingCredits??null};
}
