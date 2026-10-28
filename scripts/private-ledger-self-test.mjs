import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
import {openHostedPredictionLedger} from './hosted-prediction-ledger.mjs';
const rl=createInterface({input:process.stdin});const line=await new Promise(resolve=>rl.once('line',resolve));rl.close();let input=JSON.parse(line);
const options={token:input.token,synthetic:true};input=null;
const now=Date.now(),date=new Date(now-60000).toISOString().slice(0,10);
const snapshot={kind:'prop',eventId:randomBytes(16).toString('hex'),nhlGameId:'2026020100',date,startTime:new Date(now-60000).toISOString(),playerId:'8470001',side:'Over',line:2.5,quote:{decimal:2.1,bookmaker:'synthetic_book',lastUpdate:new Date(now-180000).toISOString()},capturedAt:new Date(now-120000).toISOString(),sourceCommit:'205568d',modelVersion:'shots-v1',probability:{over:.6,under:.4,push:0},baselineProbability:{over:.5,under:.5,push:0},modelInputs:{mean:3,alpha:0,sample:40},candidate:true,checks:[],trainingEnd:new Date(now-86400000).toISOString().slice(0,10)};
let store=openHostedPredictionLedger(options);
try{
 const ack=await store.appendPrediction(snapshot),duplicate=await store.appendPrediction(snapshot);assert(!ack.duplicate&&duplicate.duplicate);assert.equal(ack.digest,duplicate.digest);
 await assert.rejects(store.appendPrediction({...snapshot,probability:{over:.7,under:.3,push:0}}),/409/);
 const firstInput={predictionId:ack.id,previousGradeDigest:null,gradedAt:new Date().toISOString(),result:{state:'win',shots:4}},first=await store.appendGrade(firstInput,snapshot);
 const correction=await store.appendGrade({predictionId:ack.id,previousGradeDigest:first.digest,gradedAt:new Date().toISOString(),result:{state:'loss',shots:1}},snapshot);
 await assert.rejects(store.appendGrade({...firstInput,result:{state:'loss',shots:1}},snapshot),/409/);
 const read=await store.read(ack.id);assert.equal(read.result.state,'loss');assert.equal(read.resultHistory[0].state,'win');assert.equal(read.head,correction.digest);assert.equal(read.digest,ack.digest);
 const beforeCorrection=await store.read(ack.id,{asOf:first.receivedAt});assert.equal(beforeCorrection.result.state,'win');
 store.close();store=openHostedPredictionLedger(options);const restored=await store.restore();const item=restored.events.flatMap(e=>e.records).find(r=>r.ledgerId===ack.id);assert.equal(item.result.state,'loss');assert.equal(item.resultHistory[0].state,'win');
 const live=openHostedPredictionLedger({...options,synthetic:false});try{await assert.rejects(live.appendPrediction(snapshot),/503/)}finally{live.close()}
 console.log(JSON.stringify({synthetic:true,predictionId:ack.id,persisted:true,duplicateVerified:true,conflictRejected:true,gradeCorrectionPreserved:true,cutoffVerified:true,reopenedAndRestored:true,liveIngestion:'paused'}));
}finally{store.close();options.token=null}
