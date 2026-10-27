import assert from 'node:assert/strict';
import {bestQuotes,ranked,createScanner} from '../best-picks-engine.js';
const now=Date.parse('2026-10-25T21:00:00Z');
function row({kind='props',book='a',decimal=2,age=0,ev=.1,start=now+3600000,fail=false,side='Over',eventId='one'}={}){const q={market:kind==='props'?'player_shots_on_goal':'h2h',player:kind==='props'?'Player':'',point:kind==='props'?2.5:null,side:kind==='props'?side:'Home',decimal,bookmaker:book,lastUpdate:new Date(now-age).toISOString()};const test={games:100,brier:fail?.4:.1,baseline:.2};return {kind,quote:q,event:{eventId,id:eventId,commenceTime:new Date(start).toISOString(),startTime:new Date(start).toISOString(),verified:true,nhlGameId:'2026020186',homeAbbrev:'TOR',awayAbbrev:'CGY',gameDay:{gameId:'2026020186',pregame:true,gameState:'FUT',startTime:new Date(start).toISOString(),checkedAt:new Date(now).toISOString(),home:{team:'TOR',goalie:{status:'confirmed',playerId:'8479318'}},away:{team:'CGY',goalie:{status:'confirmed',playerId:'8479319'}}}},label:'Pick',value:{ev},analysis:kind==='props'?{result:{prediction:{over:.6,under:.4,push:0},low:{over:.6,under:.4,push:0},high:{over:.6,under:.4,push:0},test},context:{venue:'H',rosterVerified:true,rosterCheckedAt:new Date(now).toISOString()}}:{test,probability:{win:.6,loss:.4,push:0},worstValue:.1,archiveAt:new Date(now).toISOString(),archiveErrors:0}}}
assert.equal(bestQuotes([row(),row({book:'b',decimal:2.2})],'',now)[0].quote.bookmaker,'b');
assert.equal(bestQuotes([row(),row({book:'b',decimal:3,age:16*60000})],'',now)[0].quote.bookmaker,'a');
assert.equal(bestQuotes([row(),row({book:'b',decimal:2.2})],'a',now)[0].quote.bookmaker,'a');
assert.equal(bestQuotes([row(),row({eventId:'two'})],'',now).length,2);
assert.equal(ranked([row({start:now-1})],{now}).length,0);
assert.equal(ranked([row({fail:true})],{now}).length,0);
assert.equal(ranked([row({fail:true})],{now,includeFailed:true}).length,1);
assert.equal(ranked([row({age:16*60000})],{now}).length,0);
assert.equal(ranked([row(),row({kind:'games'})],{kind:'games',now}).length,1);
assert.deepEqual(ranked([row({eventId:'one',ev:.1}),row({eventId:'two',ev:.2})],{now}).map(r=>r.value.ev),[.2,.1]);
let reads=0;const scan=createScanner(async()=>{reads++;throw Error('offline')});const output=await scan([{id:'a',commenceTime:new Date(Date.now()+3600000).toISOString(),homeTeam:'Home',awayTeam:'Away'}]);assert.equal(output.rows.length,0);assert.equal(output.issues.length,3);assert.equal(reads,3);
const past=await scan([{id:'a',commenceTime:new Date(0).toISOString()}],{games:false});assert.equal(past.rows.length,0);assert.equal(reads,3);
console.log('Best Picks: quote selection, filtering, ranking, expiry and unavailable feeds passed');


const {marketComparison}=await import('../best-picks-engine.js');
const quoteRow=(side,decimal)=>({event:{id:'margin-test'},quote:{market:'h2h',side,point:null,decimal,bookmaker:'book',lastUpdate:new Date().toISOString()},value:{conditional:.6}});
const home=quoteRow('Home',1.9),away=quoteRow('Away',1.9);const margin=marketComparison(home,[home,away]);assert.equal(margin.noVig,.5);assert(Math.abs(margin.edge-.1)<1e-10);assert.equal(marketComparison(home,[home]).noVig,null);assert.equal(marketComparison(home,[home,away,{...away,quote:{...away.quote,bookmaker:'other'}}]).noVig,.5);
