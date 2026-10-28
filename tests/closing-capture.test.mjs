import assert from 'node:assert/strict';
import {captureClosingPrices} from '../scripts/closing-capture.mjs';
import {normalizeClosingObservation} from '../scripts/closing-observation-schema.mjs';
import {closingValue} from '../evaluation-core.js';
const now=Date.now(),id='a'.repeat(32),snapshot={eventId:id,nhlGameId:'2026020100',date:new Date(now).toISOString().slice(0,10),startTime:new Date(now+300000).toISOString(),capturedAt:new Date(now-3600000).toISOString(),playerId:'8470001',side:'Over',line:2.5,quote:{decimal:2.1,bookmaker:'test_book'}};
const ledger={events:[{records:[{ledgerId:'b'.repeat(64),snapshot}],gameRecords:[]}]};let paid=0,calls=[],balance=12,priceTime=new Date(now-30000).toISOString(),claimed=false;
const client=async path=>{calls.push(path);if(path==='/api/budget-status')return {availableCredits:balance};if(path.startsWith('/api/nhl-schedule'))return {games:[{id:snapshot.nhlGameId,gameState:'FUT',startTimeUTC:snapshot.startTime,homeTeam:{abbrev:'TOR'},awayTeam:{abbrev:'CAR'}}]};if(path.startsWith('/api/nhl-player-profile'))return {id:snapshot.playerId,name:'Synthetic Player',team:'TOR'};if(path.startsWith('/api/nhl-props')){paid++;return {status:'live',eventId:id,commenceTime:snapshot.startTime,odds:[{player:'Synthetic Player',side:'Over',point:2.5,bookmaker:'test_book',decimal:1.9,lastUpdate:priceTime}]}}throw Error('Unexpected route')};
const observations=[],store={status:async()=>({writesEnabled:true}),claim:async()=>{const allowed=!claimed;claimed=true;return {claimed:allowed}},append:async(input,s)=>{observations.push(normalizeClosingObservation(input,s))}};
let report=await captureClosingPrices(ledger,client,{closingStore:store,clock:()=>now});assert.equal(paid,1);assert.equal(report.saved,1);assert.equal(observations[0].source,'the-odds-api');assert.equal(closingValue(snapshot,observations,now),null);assert(Math.abs(closingValue(snapshot,observations,now+300001).priceRatio-(2.1/1.9-1))<1e-10);
report=await captureClosingPrices(ledger,client,{closingStore:store,clock:()=>now});assert.equal(paid,1);assert.equal(report.attemptedGroups,0);
calls=[];await captureClosingPrices(ledger,client,{closingStore:{status:async()=>({writesEnabled:false})},clock:()=>now});assert.equal(calls.length,0);
claimed=false;balance=0;report=await captureClosingPrices(ledger,client,{closingStore:store,clock:()=>now});assert.equal(claimed,false);assert.equal(paid,1);
balance=12;priceTime=new Date(now-16*60000).toISOString();report=await captureClosingPrices(ledger,client,{closingStore:store,clock:()=>now});assert.equal(report.saved,0);assert.equal(report.missing,1);assert.equal(paid,2);
calls=[];await captureClosingPrices(ledger,client,{closingStore:store,clock:()=>now+300000});assert.equal(calls.length,0);
const copied={...observations[0],receivedAt:new Date(now+400000).toISOString()};assert.equal(closingValue(snapshot,[copied],now+300001),null);
console.log('Closing collector: matched book/line/player, protected budget, once-only attempts, stale/missing quotes, no poststart requests and receipt-aware CLV passed');
const gameSnapshot={...snapshot,kind:'game',playerId:null,market:'h2h',side:'Home',line:null},gameLedger={events:[{records:[],gameRecords:[{ledgerId:'c'.repeat(64),snapshot:gameSnapshot}]}]};let gameCalls=0;
const gameClient=async path=>{if(path.startsWith('/api/nhl-schedule'))return {games:[{id:snapshot.nhlGameId,gameState:'FUT',startTimeUTC:snapshot.startTime,homeTeam:{abbrev:'TOR'},awayTeam:{abbrev:'CAR'}}]};if(path==='/api/budget-status')return {availableCredits:3};if(path.startsWith('/api/nhl-game-odds')){gameCalls++;return {status:'live',eventId:id,commenceTime:snapshot.startTime,odds:[{market:'h2h',side:'Home',point:null,bookmaker:'test_book',decimal:1.9,lastUpdate:new Date(now).toISOString()}]}}throw Error('Unsupported game source')};
const gameReport=await captureClosingPrices(gameLedger,gameClient,{clock:()=>now,closingStore:{status:async()=>({writesEnabled:true}),claim:async()=>({claimed:true}),append:async(input,s)=>normalizeClosingObservation(input,s)}});assert.equal(gameReport.saved,1);assert.equal(gameCalls,1);

// A durable claim may take long enough to cross the earlier official start.
let movingClock=now,lateCalls=0;
const slowClaimStore={status:async()=>({writesEnabled:true}),claim:async()=>{movingClock=now+300000;return {claimed:true}},append:async()=>assert.fail('No late persistence')};
const slowClient=async path=>{if(path.startsWith('/api/nhl-props'))lateCalls++;return client(path)};
balance=12;priceTime=new Date(now).toISOString();
const stopped=await captureClosingPrices(ledger,slowClient,{closingStore:slowClaimStore,clock:()=>movingClock});assert.equal(stopped.attemptedGroups,1);assert.equal(lateCalls,0);assert(stopped.notes.some(n=>n.includes('start reached')));
// Even if the snapshot start remains future, the earlier verified NHL time wins.
movingClock=now;const earlierClient=async path=>path.startsWith('/api/nhl-schedule')?{games:[{id:snapshot.nhlGameId,gameState:'PRE',startTimeUTC:new Date(now+1000).toISOString(),homeTeam:{abbrev:'TOR'},awayTeam:{abbrev:'CAR'}}]}:slowClient(path);
const earlier=await captureClosingPrices(ledger,earlierClient,{closingStore:{...slowClaimStore,claim:async()=>{movingClock=now+1001;return {claimed:true}}},clock:()=>movingClock});assert.equal(lateCalls,0);assert.equal(earlier.saved,0);
console.log('Closing capture rechecks earliest verified start after durable claim; no post-start provider request.');
