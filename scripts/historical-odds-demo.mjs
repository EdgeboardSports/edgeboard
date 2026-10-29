// Deterministic arithmetic demonstration. All quotes, outcomes and players are fabricated.
import {evaluateHistoricalOdds} from './historical-odds-evaluator.mjs';
const startTime='2026-01-01T19:00:00Z',predictedAt='2026-01-01T18:00:00Z',observedAt='2026-01-01T17:50:00Z';
const scenarios=[
 {id:'fixture-a',eventId:'fake-event-1',market:'player_shots_on_goal',subjectId:'fake-player-1',line:2.5,side:'Over',probability:.6,result:'win',decimal:2.1,counter:1.8},
 {id:'fixture-b',eventId:'fake-event-2',market:'player_shots_on_goal',subjectId:'fake-player-2',line:2.5,side:'Under',probability:.4,result:'loss',decimal:1.9,counter:1.9},
 {id:'fixture-c',eventId:'fake-event-3',market:'h2h',subjectId:null,line:null,side:'Home',probability:.56,result:'push',decimal:1.9,counter:1.95},
 {id:'fixture-d',eventId:'fake-event-4',market:'totals',subjectId:null,line:5.5,side:'Over',probability:.54,result:'pending',decimal:2.05,counter:1.8}
];
const predictions=scenarios.map(({id,eventId,market,subjectId,line,side,probability,result})=>({id,eventId,market,subjectId,line,side,probability,result,startTime,predictedAt}));
const opposite=s=>({Over:'Under',Under:'Over',Home:'Away',Away:'Home'})[s];
const quotes=scenarios.flatMap(s=>[{
 eventId:s.eventId,market:s.market,subjectId:s.subjectId,line:s.line,side:s.side,
 bookmaker:'fictional-book',decimal:s.decimal,observedAt,source:'synthetic-fixture'
},{
 eventId:s.eventId,market:s.market,subjectId:s.subjectId,line:s.line,side:opposite(s.side),
 bookmaker:'fictional-book',decimal:s.counter,observedAt,source:'synthetic-fixture'
}]);
console.log(JSON.stringify(evaluateHistoricalOdds({mode:'synthetic',predictions,quotes}),null,2));
