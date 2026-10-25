import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../shots-model.js',import.meta.url),'utf8');
const {probabilities,quoteValue,fit,backtest,validGames,minutes}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const near=(a,b)=>assert(Math.abs(a-b)<1e-10,a+' != '+b);
near(probabilities(2,0,0.5).under,Math.exp(-2));
near(probabilities(2,.5,0.5).under,.25);
near(probabilities(2,.5,1.5).under,.5);
for(const mean of [.01,.5,2,5,15])for(const alpha of [0,.01,.5,1])for(const line of [0,.5,1,1.5,2.5,5,10]){
 const p=probabilities(mean,alpha,line);near(p.over+p.under+p.push,1);assert(p.over>=0&&p.under>=0&&p.push>=0);
 if(!Number.isInteger(line))near(p.push,0);
}
near(quoteValue({over:.4,under:.3,push:.3},'Over',2).ev,.1);
near(quoteValue({over:.4,under:.3,push:.3},'Under',2).ev,-.1);
near(quoteValue({over:.4,under:.3,push:.3},'Over',2).conditional,4/7);
assert.equal(minutes('20:30'),20.5);assert.equal(minutes('20:99'),null);
assert.equal(validGames([{gameId:1,gameDate:'2026-01-01',shots:null}]).length,0);
const games=Array.from({length:80},(_,i)=>({gameId:i+1,gameDate:new Date(Date.UTC(2025,9,1+i*2)).toISOString().slice(0,10),shots:(i*7)%6,homeRoadFlag:i%2?'H':'R',opponentAbbrev:'TST',toi:'20:00'}));
assert.equal(fit(games.slice(0,19)),null);
const test=backtest(games,2.5);assert.equal(test.games,40);assert(test.brier>=0&&test.brier<=1);
for(const t of test.tests)assert(t.trainingEnd<t.date);
const changed=games.map((g,i)=>({...g,shots:i===79?20:g.shots})),changedTest=backtest(changed,2.5);
near(test.tests.at(-1).predicted,changedTest.tests.at(-1).predicted);
assert.deepEqual(test.tests.slice(0,-1),changedTest.tests.slice(0,-1));
assert.equal(backtest(games.slice(0,20),2.5).games,0);
console.log('Passed probability mass, Poisson/NB references, push-aware EV, data validation, minimum sample, rolling chronology and target/future leakage tests.');
