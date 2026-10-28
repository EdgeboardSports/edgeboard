import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {aggregate,freezePrediction,gradePrediction} from '../paper-core.js';
import {runPaper} from '../scripts/paper-runner.mjs';
const now=Date.parse('2026-10-25T15:00:00Z'),start='2026-10-25T17:00:00Z',id='a'.repeat(32),hash=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const p={over:.6,under:.4,push:0},quote={player:'Player One',point:2.5,side:'Over',decimal:2,american:100,bookmaker:'test',bookmakerTitle:'Test',lastUpdate:new Date(now).toISOString()},games=Array.from({length:80},(_,i)=>({gameId:i+100,gameDate:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),shots:i%5,homeRoadFlag:'H',opponentAbbrev:'AWY',toi:'20:00'}));
const analysis={context:{venue:'H',rosterVerified:true,rosterCheckedAt:new Date(now).toISOString()},result:{prediction:p,low:p,high:p,model:{mean:3},test:{games:40,brier:.2,baseline:.25}}},event={id,nhlGameId:11,date:'2026-10-25',commenceTime:start,homeTeam:'Team Home',awayTeam:'Team Away'};
const snapshot=freezePrediction({analysis,quote,event,player:{id:'8477500'},capturedAt:new Date(now).toISOString(),sourceCommit:'test',games});assert(snapshot.candidate);assert.equal(snapshot.quote.american,100);
assert.throws(()=>freezePrediction({analysis,quote,event,player:{id:'8477500'},capturedAt:start,games}),/after start/);
const final={gameState:'OFF'},log=[{gameId:11,shots:3}];assert.deepEqual(gradePrediction(snapshot,final,log,now),{state:'win',shots:3,units:1});
assert.equal(gradePrediction({...snapshot,line:3},final,log,now).state,'push');
assert.equal(gradePrediction({...snapshot,side:'Under'},final,log,now).state,'loss');
assert.equal(gradePrediction(snapshot,{gameState:'LIVE'},log,now).state,'pending');
assert.equal(gradePrediction(snapshot,final,[],Date.parse(start)+25*3600000).state,'void');
assert.equal(gradePrediction(snapshot,final,[{gameId:11,shots:null}],now).state,'pending');
const records=[{snapshot,result:{state:'win',shots:3,units:1}},{snapshot:{...snapshot,side:'Under'},result:{state:'loss',shots:3,units:-1}}],stats=aggregate(records);assert.equal(stats.uniqueTests,1);assert.equal(stats.roi,0);assert.equal(aggregate([]).roi,null);
const before=JSON.stringify(snapshot);gradePrediction(snapshot,final,log,now);assert.equal(JSON.stringify(snapshot),before);
const ledger={schemaVersion:1,events:[],runs:[],remainingCredits:null};
const source=async path=>{
 if(path==='/api/nhl-events')return {events:[{id,homeTeam:'Team Home',awayTeam:'Team Away',commenceTime:start}],remainingCredits:400};
 if(path.startsWith('/api/nhl-schedule'))return {games:[{id:11,startTimeUTC:start,gameState:'FUT',gameType:2,homeTeam:{name:{default:'Home'},abbrev:'HOM'},awayTeam:{name:{default:'Away'},abbrev:'AWY'}}]};
 if(path.startsWith('/api/nhl-props'))return {status:'live',fetchedAt:new Date(now).toISOString(),odds:[quote,{...quote,side:'Under',american:-110,decimal:1+100/110}],remainingCredits:399};
 if(path.startsWith('/api/nhl-player-search'))return {players:[{id:'8477500',name:'Player One',team:'HOM'}]};
 if(path.startsWith('/api/nhl-roster'))return {team:'HOM',playerIds:['8477500'],checkedAt:new Date(now).toISOString()};
 if(path.startsWith('/api/nhl-game-log'))return {games};
 throw Error('Unexpected endpoint');
};
await runPaper(ledger,source,{clock:()=>now,sourceCommit:'first'});assert.equal(ledger.events.length,1);assert.equal(ledger.events[0].records.length,2);const original=JSON.stringify(ledger.events[0].records);
await runPaper(ledger,source,{clock:()=>now+1000,sourceCommit:'second'});assert.equal(ledger.events.length,1);assert.equal(JSON.stringify(ledger.events[0].records),original);
const later=structuredClone(ledger);const gradingSource=async path=>path.startsWith('/api/nhl-schedule')?{games:[{id:11,gameState:'OFF'}]}:path.startsWith('/api/nhl-game-log')?{games:log}:path==='/api/nhl-events'?{events:[]}:source(path);
await runPaper(later,gradingSource,{clock:()=>now+86400000,sourceCommit:'grade'});assert.equal(later.events[0].records[0].result.state,'win');assert.equal(later.events[0].records[0].digest,hash(later.events[0].records[0].snapshot));assert.equal(JSON.stringify(later.events[0].records[0].snapshot),JSON.stringify(ledger.events[0].records[0].snapshot));
const late={schemaVersion:1,events:[],runs:[]};await runPaper(late,source,{clock:()=>Date.parse(start)+1000});assert.equal(late.events.length,0);
const budget={schemaVersion:1,events:[],runs:[],remainingCredits:50};await runPaper(budget,async path=>path==='/api/nhl-events'?{events:[{id,commenceTime:start}],remainingCredits:50}:source(path),{clock:()=>now});assert.equal(budget.events.length,0);
console.log('Passed: immutable pregame capture, late capture refusal, grading, DNP/push/missing stats, ROI and deduplication, idempotence, automatic grading and quota reserve.');

const many={schemaVersion:1,events:[],runs:[]};let propCalls=0;
const manySource=async path=>{
 if(path==='/api/nhl-events')return {events:[0,1,2].map(i=>({id:String(i+1).repeat(32),homeTeam:'Team Home '+i,awayTeam:'Team Away',commenceTime:start})),remainingCredits:400};
 if(path.startsWith('/api/nhl-schedule'))return {games:[0,1,2].map(i=>({id:11+i,startTimeUTC:start,gameState:'FUT',gameType:2,homeTeam:{name:{default:'Home '+i},abbrev:'HOM'},awayTeam:{name:{default:'Away'},abbrev:'AWY'}}))};
 if(path.startsWith('/api/nhl-props'))propCalls++;
 return source(path);
};
await runPaper(many,manySource,{clock:()=>now});assert.equal(many.events.length,2);assert.equal(propCalls,2);
const corrupt=structuredClone(ledger);corrupt.events[0].records[0].snapshot.line=9;
await runPaper(corrupt,gradingSource,{clock:()=>now+86400000});assert(corrupt.runs.at(-1).errors.some(e=>e.includes('integrity')));
assert.throws(()=>freezePrediction({analysis,quote,event,player:{id:'8477500'},capturedAt:new Date(now).toISOString(),games:[...games,{gameDate:'2026-10-25',shots:4}]}),/future dates/);
console.log('Passed daily two-game cap, snapshot tamper detection, and target-date exclusion.');

const {makeClient}=await import('../scripts/paper-runner.mjs');let attempts=0;
const retry=makeClient('https://app.test',{pause:async()=>{},fetchImpl:async url=>{attempts++;return url.startsWith('https://api-web.nhle.com')?new Response(JSON.stringify({games:[{id:7}]}),{status:200}):new Response('{}',{status:502})}});
await assert.rejects(()=>retry('/api/nhl-schedule?date=2026-10-25'));assert.equal(attempts,3);
attempts=0;await assert.rejects(()=>retry('/api/nhl-props?event=x&market=y'));assert.equal(attempts,1);
console.log('Passed bounded retries, no direct NHL fallback and no automatic paid-odds retry.');


const freshLedger={schemaVersion:1,events:[],runs:[],remainingCredits:400};
await runPaper(freshLedger,async path=>{
 if(path.startsWith('/api/nhl-props'))return {status:'live',odds:[{...quote,decimal:9,lastUpdate:new Date(now-16*60000).toISOString()},quote],remainingCredits:399};
 return source(path);
},{clock:()=>now});
assert.equal(freshLedger.events[0].records[0].snapshot.quote.decimal,2);
assert.equal(freshLedger.events[0].records[0].snapshot.playerVerification.rosterVerified,true);
const noRoster={schemaVersion:1,events:[],runs:[],remainingCredits:400};
await runPaper(noRoster,async path=>path.startsWith('/api/nhl-roster')?{team:'HOM',playerIds:[],checkedAt:new Date(now).toISOString()}:source(path),{clock:()=>now});
assert(noRoster.events[0].records.every(r=>!r.snapshot.candidate&&r.snapshot.checks.includes('Current NHL roster unverified')));
console.log('Passed collector integration: stale superior quote cannot displace fresh quote; missing roster blocks shortlist.');
