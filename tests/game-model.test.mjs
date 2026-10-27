import assert from 'node:assert/strict';
import {normalizeGame,fitGame,marketProbabilities,gradeGame,gameValue,gameBacktest,analyzeGame,gameChecks} from '../game-model.js';
import {freezeGame,aggregateGames} from '../game-paper.js';
import {buildArchive} from '../scripts/game-archive.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-9,a+' != '+b);
const raw=(type,h,a)=>({id:1,season:20252026,gameType:2,gameState:'OFF',gameDate:'2026-01-01',homeTeam:{abbrev:'HOM',score:h},awayTeam:{abbrev:'AWY',score:a},gameOutcome:{lastPeriodType:type}});
let g=normalizeGame(raw('SO',4,3));assert.equal(g.homeGoals,3);assert.equal(g.awayGoals,3);
assert.equal(normalizeGame(raw('OT',5,3)),null);assert.equal(normalizeGame(raw('unknown',4,3)),null);assert.equal(normalizeGame({...raw('REG',4,2),gameType:3}),null);
const s=(market,side,line=null)=>({market,side,line,quote:{decimal:2}});
assert.equal(gradeGame(s('h2h','Home'),raw('OT',4,3)).state,'win');
assert.equal(gradeGame(s('h2h_3_way','Home'),raw('OT',4,3)).state,'loss');
assert.equal(gradeGame(s('h2h_3_way','Draw'),raw('OT',4,3)).state,'win');
assert.equal(gradeGame(s('h2h_3_way','Draw'),raw('SO',2,1)).state,'win');
assert.equal(gradeGame(s('spreads','Home',-1.5),raw('SO',2,1)).state,'loss');
assert.equal(gradeGame(s('spreads','Away',1),raw('SO',2,1)).state,'push');
assert.equal(gradeGame(s('h2h_3_way','Draw'),raw('unknown',4,3)).state,'pending');
assert.equal(gradeGame(s('h2h','Home'),{...raw('REG',4,2),gameState:'LIVE'}).state,'pending');
const model={home:2.8,away:2.8,overtimeHome:.5};
near(marketProbabilities(model,'h2h','Home').win,.5);
for(const market of ['h2h','spreads','h2h_3_way'])for(const side of market==='h2h_3_way'?['Home','Away','Draw']:['Home','Away'])for(const point of [-1.5,-1,0,1,1.5]){
 const p=marketProbabilities(model,market,side,point);near(p.win+p.loss+p.push,1);near(p.regulation.home+p.regulation.draw+p.regulation.away,1);
}
near(gameValue({win:.4,loss:.3,push:.3},2).ev,.1);
const games=Array.from({length:140},(_,i)=>({id:i+1,season:20252026,date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),home:'HOM',away:'AWY',homeGoals:i%4+1,awayGoals:i%3,finalHome:i%4+1,finalAway:i%3,endType:'REG'})).filter(g=>g.finalHome!==g.finalAway);
const archive={generatedAt:'2026-10-25T15:00:00Z',games,errors:[]},event={id:'a'.repeat(32),nhlGameId:3,date:'2026-10-25',startTime:'2026-10-25T18:00:00Z',homeAbbrev:'HOM',awayAbbrev:'AWY',homeTeam:'Home',awayTeam:'Away',verified:true},quote={market:'h2h',side:'Home',point:null,decimal:2,american:100,bookmaker:'test',bookmakerTitle:'Test',lastUpdate:'2026-10-25T15:00:00Z'};
const a=analyzeGame(archive,event,quote);assert(a);assert.equal(a.test.games,Math.min(100,games.length-20));assert(a.test.tests.every(t=>t.trainingEnd<t.date));
assert.equal(fitGame(games.slice(0,19),'HOM','AWY',event.date),null);
const changed={...archive,generatedAt:'2026-10-25T15:00:01Z',games:games.map((g,i)=>({...g,homeGoals:i===games.length-1?10:g.homeGoals}))},test=gameBacktest(archive,'h2h','Home',null,event.date),changedTest=gameBacktest(changed,'h2h','Home',null,event.date);near(test.tests[0].loss,changedTest.tests[0].loss);
const snapshot=freezeGame({analysis:a,quote,event,capturedAt:'2026-10-25T15:00:00Z',sourceCommit:'test'});assert.throws(()=>freezeGame({analysis:a,quote,event,capturedAt:event.startTime}),/after start/);assert.equal(snapshot.modelVersion,'goals-v1');
const record={snapshot,result:gradeGame(snapshot,raw('SO',2,1))};const metrics=aggregateGames([record]);assert.equal(metrics.wins,1);assert.equal(metrics.uniqueTests,1);assert.equal(metrics.roi,1);
assert(gameChecks(a,quote,{...event,verified:false},Date.parse('2026-10-25T15:00:00Z')).includes('Upcoming NHL matchup unverified'));
console.log('Passed: regulation/OT/SO normalization and grading; puck-line pushes; probability mass; symmetric moneylines; push-aware value; training minimum; time-ordered test; frozen capture and game metrics.');

for(const line of [5,5.5,6,6.5]){const over=marketProbabilities(model,'totals','Over',line),under=marketProbabilities(model,'totals','Under',line);near(over.win+over.loss+over.push,1);near(over.win,under.loss);near(over.push,under.push)}
assert.equal(gradeGame(s('totals','Over',6),raw('REG',4,2)).state,'push');
assert.equal(gradeGame(s('totals','Under',6.5),raw('SO',4,3)).state,'loss');
assert.throws(()=>marketProbabilities(model,'totals','Home',6));
assert.equal(gradeGame(s('unknown','Home'),raw('REG',4,2)).state,'pending');
