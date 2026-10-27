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

const {decisionBoard}=await import('../best-picks-engine.js');
const prop=row({decimal:2}),game=row({kind:'games',eventId:'two',decimal:2.2});
const mixed=decisionBoard([prop,game],{now});
assert.deepEqual(mixed.rows.map(r=>r.kind),['games','props']);
assert(Math.abs(mixed.rows[0].value.ev-.32)<1e-10);
assert.equal(mixed.independentEvents,2);
assert(Math.abs(mixed.rows[0].decision.fairDecimal-1.6666666666666667)<1e-10);
// Cached/forged EV cannot reorder the board.
assert.deepEqual(decisionBoard([{...prop,value:{ev:999}},game],{now}).rows.map(r=>r.kind),['games','props']);
const failed=row({kind:'games',decimal:5,fail:true,eventId:'failed'});
assert.equal(decisionBoard([failed,prop],{now}).rows.length,1);
const audit=decisionBoard([failed,prop],{now,includeFailed:true});
assert.equal(audit.rows[0].kind,'props');assert(audit.rows[1].reasons.length>0);
const alternative={...prop,quote:{...prop.quote,point:3.5}};
const opposite={...prop,quote:{...prop.quote,side:'Under',decimal:3}};
const collapsed=decisionBoard([prop,alternative,opposite],{now});
assert.equal(collapsed.rows.length,1);assert.equal(collapsed.alternativesHidden,2);
assert.equal(decisionBoard([prop,alternative,opposite],{now,collapseAlternatives:false}).rows.length,3);
const otherPlayer={...prop,quote:{...prop.quote,player:'Second Player'}};
const sameGame=decisionBoard([prop,otherPlayer],{now});assert.equal(sameGame.rows.length,2);assert(sameGame.rows.every(r=>r.decision.sameEventSelections===2));
assert.equal(decisionBoard([prop,game],{now,kind:'games'}).rows.length,1);
assert.equal(decisionBoard([prop,game],{now,book:'missing'}).rows.length,0);
const badPrice={...prop,quote:{...prop.quote,decimal:NaN}},badProbability={...game,analysis:{...game.analysis,probability:{win:.8,loss:.8,push:0}}};
assert.equal(decisionBoard([badPrice,badProbability],{now}).omittedInvalid,2);
assert.equal(bestQuotes([badPrice], '', now).length,0);
const many=Array.from({length:15},(_,i)=>row({eventId:String(i)}));assert.equal(decisionBoard(many,{now}).rows.length,10);
assert.equal(decisionBoard([row({start:now-1})],{now}).rows.length,0);
assert.throws(()=>decisionBoard([],{limit:0}));
console.log('Passed combined Top 10, recomputed EV, eligibility-first ordering, alternative suppression, correlation counts and invalid-input exclusion.');
