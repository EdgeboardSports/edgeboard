import assert from 'node:assert/strict';
import {goalieStatus,matchProviderEvent,normalizeScratches,onRequestGet} from '../functions/api/nhl-game-context.js';
import {confirmedGoalies,currentGameDay,playerLineup,loadGameDay,refreshGameDay,gameDayLines} from '../game-day.js';
import {researchChecks} from '../paper-core.js';
import {gameChecks} from '../game-model.js';
const now=Date.parse('2026-10-26T20:00:00Z'),start='2026-10-26T23:00:00Z',stamp=new Date(now).toISOString();
const game={id:2026020185,gameType:2,gameDate:'2026-10-26',gameState:'FUT',startTimeUTC:start,homeTeam:{abbrev:'NYR'},awayTeam:{abbrev:'LAK'}};
const probable=(side,team,name,id,status)=>({homeAway:side,team:{id,abbreviation:team},probables:[{name:'probableStartingGoalie',athlete:{fullName:name,team:{id},jersey:'35',position:'G'},status:{type:status,name:status}}]});
const home=probable('home','NYR','Goalie One','1','confirmed'),away=probable('away','LA','Goalie Two','2','expected');
const roster=id=>({goalies:[{id,firstName:{default:'Goalie'},lastName:{default:id===8470001?'One':'Two'},sweaterNumber:35}]});
assert.equal(goalieStatus(home,roster(8470001)).status,'confirmed');assert.equal(goalieStatus(away,roster(8470002)).status,'projected');
for(const type of ['likely','starter','unknown',undefined])assert.equal(goalieStatus({...home,probables:[{...home.probables[0],status:{type}}]},roster(8470001)).status,'unknown');
assert.equal(goalieStatus(home,roster(8470002)).status,'unknown');assert.equal(goalieStatus(home,{goalies:[...roster(8470001).goalies,...roster(8470001).goalies]}).status,'unknown');
assert.equal(goalieStatus({...home,team:{id:'wrong'}},roster(8470001)).status,'unknown');
const wrongJersey=structuredClone(home);wrongJersey.probables[0].athlete.jersey='31';assert.equal(goalieStatus(wrongJersey,roster(8470001)).status,'unknown');
const provider={id:'401892582',date:start,competitions:[{competitors:[home,away]}]};assert.equal(matchProviderEvent({events:[provider]},game).id,provider.id);
assert.equal(matchProviderEvent({events:[provider,provider]},game),null);assert.equal(matchProviderEvent({events:[{...provider,date:'2026-10-27T01:00:00Z'}]},game),null);
assert.equal(normalizeScratches({gameInfo:{homeTeam:{scratches:[]}}},'home').status,'unknown');assert.equal(normalizeScratches({},'home').completeLineup,undefined);
const rail={seasonSeries:[{id:game.id,homeTeam:game.homeTeam,awayTeam:game.awayTeam}],gameInfo:{homeTeam:{scratches:[{id:8471234,firstName:{default:'Player'},lastName:{default:'Out'}}]},awayTeam:{scratches:[]}}};
const d={gameId:String(game.id),date:game.gameDate,pregame:true,gameState:'FUT',startTime:start,checkedAt:stamp,home:{team:'NYR',goalie:goalieStatus(home,roster(8470001)),lineup:normalizeScratches(rail,'home')},away:{team:'LAK',goalie:goalieStatus({...away,probables:[{...away.probables[0],status:{type:'confirmed'}}]},roster(8470002)),lineup:normalizeScratches(rail,'away')}};
const event={nhlGameId:game.id,date:game.gameDate,startTime:start,commenceTime:start,homeAbbrev:'NYR',awayAbbrev:'LAK',gameDay:d,verified:true};
assert(confirmedGoalies(event,now));assert.equal(playerLineup(event,'8471234',now).status,'scratched');assert.equal(playerLineup(event,'8471235',now).status,'unknown');
assert(!confirmedGoalies(event,now+4*60000));assert(!currentGameDay({...d,gameState:'LIVE'},event,now));assert(!confirmedGoalies({...event,gameDay:{...d,checkedAt:new Date(now+120000).toISOString()}},now));
assert(!confirmedGoalies({...event,homeAbbrev:'TOR'},now));assert(!confirmedGoalies({...event,gameDay:{...d,away:{...d.away,goalie:{...d.away.goalie,status:'projected'}}}},now));
const p={over:.7,under:.3,push:0},analysis={context:{playerId:'8471234',venue:'H',rosterVerified:true,rosterCheckedAt:stamp},result:{prediction:p,low:p,high:p,test:{games:40,brier:.1,baseline:.2}}},quote={side:'Over',decimal:2,lastUpdate:stamp};
assert(researchChecks(analysis,quote,event,now).includes('Official game-day scratch'));
const ga={test:{games:100,brier:.1,baseline:.2},probability:{win:.7,loss:.3,push:0},worstValue:.1,archiveAt:stamp,archiveErrors:0};assert.deepEqual(gameChecks(ga,quote,event,now),[]);
assert(gameChecks(ga,quote,{...event,gameDay:null},now).some(s=>s.includes('Both starting goalies')));
assert(gameDayLines(event,now).some(s=>s.includes('confirmed')));assert(gameDayLines(event,now+240000).some(s=>s.includes('stale')));
let reads=0;const oldNow=Date.now;Date.now=()=>now;
try{
 const read=async()=>{reads++;return d};const rows=[{event:structuredClone(event)},{event:structuredClone(event)}];await refreshGameDay(rows,read);assert.equal(reads,1);
 await refreshGameDay(rows,async()=>({...d,away:{...d.away,goalie:{status:'projected',name:'Replacement Goalie',playerId:'8481111'}}}));assert.equal(rows[0].event.gameDay.away.goalie.name,'Replacement Goalie');assert(!confirmedGoalies(rows[0].event,now));
 await refreshGameDay(rows,async()=>{throw Error('offline')});assert.equal(rows[0].event.gameDay,null);
 assert.equal(await loadGameDay(async()=>({...d,gameId:'2026020999'}),event),null);
 const oldFetch=globalThis.fetch;
 try{
  globalThis.fetch=async url=>new Response(JSON.stringify(url.endsWith('/landing')?game:url.includes('/scoreboard?')?{events:[provider]}:url.includes('/roster/NYR')?roster(8470001):url.includes('/roster/LAK')?roster(8470002):rail));
  const response=await onRequestGet({request:new Request('https://test/api/nhl-game-context?gameId='+game.id)}),body=await response.json();assert.equal(response.status,200);assert.equal(body.home.goalie.status,'confirmed');assert.equal(body.away.goalie.status,'projected');assert.equal(body.home.lineup.players[0].id,'8471234');assert.equal(body.home.goalie.sourceUpdatedAt,null);
  assert.equal((await onRequestGet({request:new Request('https://test/api/nhl-game-context?gameId=bad')})).status,400);
  globalThis.fetch=async()=>new Response('{}',{status:503});assert.equal((await onRequestGet({request:new Request('https://test/api/nhl-game-context?gameId='+game.id)})).status,503);
 }finally{globalThis.fetch=oldFetch}
}finally{Date.now=oldNow}
console.log('Passed explicit confirmation, team/name/jersey matching, ambiguity rejection, projection/staleness, game identity, scratch gating, minute-refresh deduplication, failure handling and endpoint integration.');
