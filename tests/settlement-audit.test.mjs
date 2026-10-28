import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gradeGame} from '../game-model.js';
import {gradePrediction} from '../paper-core.js';
import {resultAsOf,paperMetrics} from '../evaluation-core.js';
const startTime='2026-01-01T12:00:00Z',final=(h=4,a=2,type='REG')=>({id:11,gameState:'OFF',homeTeam:{score:h},awayTeam:{score:a},gameOutcome:{lastPeriodType:type}});
const snap=(market,side,line=null)=>({nhlGameId:11,startTime,market,side,line,quote:{decimal:2.25}});
const cases=[['h2h','Home',null,4,2,'REG','win'],['h2h','Away',null,4,2,'REG','loss'],['h2h','Away',null,2,3,'OT','win'],['spreads','Home',-2,4,2,'REG','push'],['spreads','Away',2,4,2,'REG','push'],['spreads','Away',1.5,4,2,'REG','loss'],['spreads','Home',-1.5,4,2,'REG','win'],['h2h_3_way','Draw',null,3,2,'OT','win'],['h2h_3_way','Draw',null,3,2,'SO','win'],['h2h_3_way','Home',null,3,2,'REG','win'],['h2h_3_way','Away',null,3,2,'OT','loss'],['totals','Over',6,4,2,'REG','push'],['totals','Under',6.5,4,2,'REG','win'],['totals','Over',6.5,4,3,'SO','win']];
for(const [market,side,line,h,a,type,state] of cases){const s=snap(market,side,line),before=JSON.stringify(s),r=gradeGame(s,final(h,a,type));assert.equal(r.state,state);assert.equal(r.units,state==='win'?1.25:state==='loss'?-1:0);assert.equal(JSON.stringify(s),before)}
for(const score of [-1,'', ' ',true,false,null,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1])assert.equal(gradeGame(snap('h2h','Home'),final(score,2)).state,'pending');
for(const patch of [{side:'Invalid'},{side:null},{quote:{decimal:NaN}},{quote:{decimal:1}}])assert.equal(gradeGame({...snap('h2h','Home'),...patch},final()).state,'pending');
assert.equal(gradeGame(snap('spreads','Home',null),final()).state,'pending');
assert.equal(gradeGame(snap('h2h','Home'),{...final(),id:12}).state,'pending');
assert.equal(gradeGame(snap('h2h_3_way','Draw'),final(4,2,'OT')).state,'pending');
assert.equal(gradeGame(snap('h2h_3_way','Draw'),final(3,2,null)).state,'pending');
assert.equal(gradeGame(snap('h2h','Home'),{...final(),gameState:'POST'}).state,'pending');
const s=snap('player_shots_on_goal','Over',3),now=Date.parse(startTime)+25*3600000,hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex'),digest=hash(s);
for(const side of ['Over','Under'])for(const shots of [0,2,3,4]){const ss={...s,side},r=gradePrediction(ss,final(),[{gameId:11,shots}],now);assert.equal(r.state,shots===3?'push':(side==='Over'?shots>3:shots<3)?'win':'loss')}
for(const shots of ['', ' ',true,false,null,-1,1.5,NaN,Infinity])assert.equal(gradePrediction(s,final(),[{gameId:11,shots}],now).state,'pending');
assert.equal(gradePrediction(s,final(),[],now).state,'void');assert.equal(gradePrediction(s,final(),[],Date.parse(startTime)+24*3600000).state,'pending');
assert.equal(gradePrediction(s,final(),[{gameId:11,shots:4},{gameId:11,shots:4}],now).state,'pending');
assert.equal(gradePrediction(s,{...final(),id:12},[{gameId:11,shots:4}],now).state,'pending');
for(const patch of [{side:'Bad'},{line:NaN},{line:-1},{quote:{decimal:0}},{market:'player_points'}])assert.equal(gradePrediction({...s,...patch},final(),[{gameId:11,shots:4}],now).state,'pending');
const record={snapshot:s,resultHistory:[{...gradePrediction(s,final(),[{gameId:11,shots:4}],now),gradedAt:'2026-01-02T13:00:00Z'}],result:{...gradePrediction(s,final(),[{gameId:11,shots:2}],now),gradedAt:'2026-01-03T13:00:00Z'}};
assert.equal(resultAsOf(record,Date.parse('2026-01-02T14:00:00Z')).state,'win');assert.equal(resultAsOf(record,Date.parse('2026-01-03T14:00:00Z')).state,'loss');assert.equal(hash(s),digest);
assert.equal(paperMetrics(cases.map(([m,side,line,h,a,type])=>({snapshot:snap(m,side,line),result:gradeGame(snap(m,side,line),final(h,a,type))}))).unresolved,0);
console.log('Settlement audit: all game markets, shots, pushes, DNP timing, invalid inputs, mismatched identities, official metadata, corrections and frozen hashes passed.');
