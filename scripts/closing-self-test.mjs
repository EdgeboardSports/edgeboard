import assert from 'node:assert/strict';
import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import {openHostedPredictionLedger} from './hosted-prediction-ledger.mjs';
import {openHostedClosingStore} from './hosted-closing-store.mjs';
import {captureClosingPrices} from './closing-capture.mjs';
const rl=createInterface({input:process.stdin});const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();let input=JSON.parse(line);const token=input.token;input=null;
const store=openHostedClosingStore({token,synthetic:true}),ledgerStore=openHostedPredictionLedger({token,synthetic:true}),initial=Date.now();
const snapshot={kind:'prop',eventId:randomBytes(16).toString('hex'),nhlGameId:'2026020100',date:new Date(initial-60000).toISOString().slice(0,10),startTime:new Date(initial-60000).toISOString(),playerId:'8470001',side:'Over',line:2.5,quote:{decimal:2.1,bookmaker:'synthetic_book',lastUpdate:new Date(initial-180000).toISOString()},capturedAt:new Date(initial-120000).toISOString(),sourceCommit:'71eb019',modelVersion:'shots-v1',probability:{over:.6,under:.4,push:0},baselineProbability:{over:.5,under:.5,push:0},modelInputs:{mean:3,alpha:0,sample:40},candidate:true,checks:[],trainingEnd:new Date(initial-86400000).toISOString().slice(0,10)};
try{
 const ack=await ledgerStore.appendPrediction(snapshot),clock=()=>initial-90000,ledger={events:[{records:[{ledgerId:ack.id,snapshot}],gameRecords:[]}]};let mockPaidCalls=0;
 const client=async path=>{if(path==='/api/budget-status')return {availableCredits:12};if(path.startsWith('/api/nhl-schedule'))return {games:[{id:snapshot.nhlGameId,gameState:'FUT',startTimeUTC:snapshot.startTime,homeTeam:{abbrev:'TST'},awayTeam:{abbrev:'SYN'}}]};if(path.startsWith('/api/nhl-player-profile'))return {id:snapshot.playerId,name:'Synthetic Player',team:'TST'};if(path.startsWith('/api/nhl-props')){mockPaidCalls++;return {status:'live',eventId:snapshot.eventId,commenceTime:snapshot.startTime,odds:[{player:'Synthetic Player',side:'Over',point:2.5,bookmaker:'synthetic_book',decimal:1.9,lastUpdate:new Date(initial-100000).toISOString()}]}}throw Error('Unexpected synthetic source')};
 const first=await captureClosingPrices(ledger,client,{closingStore:store,clock});assert.equal(first.saved,1);assert.equal(first.attemptedGroups,1);
 const repeated=await captureClosingPrices(ledger,client,{closingStore:store,clock});assert.equal(repeated.attemptedGroups,0);assert.equal(mockPaidCalls,1);
 const read=async path=>{const response=await fetch('https://edgeboard-research-preview.speedystone18.chatgpt.site'+path,{headers:{'OAI-Sites-Authorization':'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});assert(response.ok);return response.json()};
 const report=await read('/collector/api/performance?scope=synthetic'),row=report.recent.find(r=>r.id===ack.id);assert(row?.clv);assert(Math.abs(row.clv.priceRatio-(2.1/1.9-1))<1e-10);
 const earlier=await read('/collector/api/performance?scope=synthetic&asOf='+encodeURIComponent(ack.receivedAt));assert.equal(earlier.recent.find(r=>r.id===ack.id).clv,null);
 const observed=await read('/collector/api/closing-observations?scope=synthetic&predictionId='+ack.id);assert.equal(observed.observations.length,1);
 const live=openHostedClosingStore({token});try{assert.equal((await live.status()).writesEnabled,false)}finally{live.close()}
 console.log(JSON.stringify({synthetic:true,predictionId:ack.id,collectorToStorageVerified:true,duplicateAttemptPrevented:true,reportMatched:true,priceRatio:row.clv.priceRatio,receiptCutoffVerified:true,realProviderRequests:0,liveClosingCapture:'paused'}));
}finally{store.close();ledgerStore.close()}
