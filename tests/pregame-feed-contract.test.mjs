import assert from 'node:assert/strict';
import {normalizePregameFeed} from '../lib/pregame-feed-contract.js';
const now=Date.parse('2026-10-28T12:00:00Z'),publishedAt='2026-10-28T11:59:00Z';
const event={providerGameId:'provider-game-1',nhlGameId:'2026020100',homeTeam:'CAR',awayTeam:'TOR',startTime:'2026-10-28T13:00:00Z'};
const roster=[{providerPlayerId:'g1',nhlPlayerId:'8470001',team:'CAR',position:'G'},{providerPlayerId:'g2',nhlPlayerId:'8470002',team:'TOR',position:'G'},{providerPlayerId:'p1',nhlPlayerId:'8470003',team:'CAR',position:'F'}];
const approval={provider:'synthetic-provider',approved:true,privateRetentionApproved:true,audience:'owner-only',allowedUses:['pregame-analysis','prediction-tracking','historical-modeling'],reference:'synthetic-test-only'};
const input={provider:approval.provider,gameId:event.providerGameId,homeTeam:'CAR',awayTeam:'TOR',startTime:event.startTime,state:'pregame',retrievedAt:new Date(now).toISOString(),goalies:[{team:'CAR',playerId:'g1',status:'confirmed',publishedAt},{team:'TOR',playerId:'g2',status:'projected',publishedAt}],availability:[],lineups:[{team:'CAR',playerIds:['g1','p1'],status:'confirmed',complete:true,publishedAt}]},options={event,roster,approval,now};
const normalize=(v=input,o=options)=>normalizePregameFeed(v,o),before=JSON.stringify({input,options});
const result=normalize();assert.equal(result.goalies[0].playerId,'8470001');assert.equal(result.goalies[0].eligibleForPregameEvidence,true);assert.equal(result.goalies[1].eligibleForPregameEvidence,false);assert.equal(result.lineups[0].complete,true);assert.deepEqual(result.availability,[]);assert.equal(JSON.stringify({input,options}),before);
for(const patch of [{approved:false},{privateRetentionApproved:false},{provider:'other'},{reference:''},{allowedUses:['pregame-analysis']},{audience:'public'},{expiresAt:'2026-10-28T12:00:00Z'}])assert.throws(()=>normalize(input,{...options,approval:{...approval,...patch}}));
for(const patch of [{gameId:'wrong'},{homeTeam:'TOR',awayTeam:'CAR'},{state:'live'},{startTime:'2026-10-28T13:16:00Z'},{startTime:'2026-10-28T11:00:00Z'},{retrievedAt:'2026-10-28T12:00:01Z'},{retrievedAt:'2026-10-28T11:56:59Z'}])assert.throws(()=>normalize({...input,...patch}));
for(const p of [{...roster[0],providerPlayerId:'g2'},{...roster[0],providerPlayerId:'alias'}, {...roster[0],nhlPlayerId:'invalid'}])assert.throws(()=>normalize(input,{...options,roster:[...roster,p]}));
for(const g of [{team:'CAR',playerId:'unknown',status:'confirmed',publishedAt},{team:'TOR',playerId:'g1',status:'confirmed',publishedAt},{team:'CAR',playerId:'p1',status:'confirmed',publishedAt},{...input.goalies[0],publishedAt:'2026-10-28T12:01:00Z'}])assert.throws(()=>normalize({...input,goalies:[g]}));
assert.throws(()=>normalize({...input,goalies:[input.goalies[0],input.goalies[0]]}));
const missing=normalize({...input,goalies:[{...input.goalies[0],publishedAt:null}]});assert.equal(missing.goalies[0].reportedStatus,'confirmed');assert.equal(missing.goalies[0].status,'unknown');assert.equal(missing.goalies[0].eligibleForPregameEvidence,false);
assert.equal(normalize({...input,lineups:[{...input.lineups[0],complete:false}]}).lineups[0].status,'unknown');
assert.equal(normalize({...input,availability:[{playerId:'p1',team:'CAR',status:'scratched',publishedAt}]}).lineups[0].status,'unknown');
assert.throws(()=>normalize({...input,availability:[{playerId:'p1',team:'CAR',status:'active',publishedAt},{playerId:'p1',team:'CAR',status:'out',publishedAt}]}));
assert.throws(()=>normalize({...input,lineups:[{...input.lineups[0],playerIds:['p1','p1']}]}));
assert.equal(normalize({...input,lineups:undefined,availability:undefined,goalies:undefined}).lineups.length,0);
const extra=normalize({...input,token:'test-secret-only',raw:{email:'do-not-retain'}});assert(!JSON.stringify(extra).includes('test-secret-only'));assert(!JSON.stringify(extra).includes('do-not-retain'));
assert.equal(normalize({...input,startTime:'2026-10-28T12:55:00Z'}).startTime,'2026-10-28T12:55:00.000Z');
console.log('Pregame contract: explicit approval, exact mapped identities, roster ambiguity, positions, pregame time, publication vs retrieval, missing data, conflicting lineup evidence and allowlisted output passed.');

const goalieConflict=normalize({...input,availability:[{playerId:'g1',team:'CAR',status:'out',publishedAt}]});assert.equal(goalieConflict.goalies[0].eligibleForPregameEvidence,false);assert.equal(goalieConflict.goalies[0].status,'unknown');assert.equal(goalieConflict.goalies[0].conflictingAvailability,true);
const retrievedOnly=normalize({...input,availability:[{playerId:'p1',team:'CAR',status:'active'}]});assert.equal(retrievedOnly.availability[0].status,'unknown');
assert.equal(normalize({...input,goalies:[{...input.goalies[0],status:'probable'}]}).goalies[0].status,'unknown');

const missingStarter=normalize({...input,lineups:[{...input.lineups[0],playerIds:['p1']}]});assert.equal(missingStarter.lineups[0].complete,false);assert.equal(missingStarter.goalies[0].eligibleForPregameEvidence,false);assert.equal(missingStarter.goalies[0].conflictingLineup,true);
assert.throws(()=>normalize({...input,availability:Array(65).fill({playerId:'p1',team:'CAR',status:'out',publishedAt})}));
assert.throws(()=>normalize({...input,lineups:[{...input.lineups[0],playerIds:Array(24).fill('p1')}]}));

for(const retrievedAt of ['2026-10-28T12:00:00','2026-02-30T12:00:00Z','2026-10-27T24:00:00Z'])assert.throws(()=>normalize({...input,retrievedAt}));
