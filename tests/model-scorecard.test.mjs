import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scorecards,renderScorecard,comparisonStatus} from '../scripts/model-scorecard.mjs';
const load=async name=>JSON.parse(await readFile(new URL('../docs/research/'+name,import.meta.url),'utf8'));
const input={shots:await load('moneypuck-shots-2025.json'),calibration:await load('moneypuck-shots-calibration-2025.json'),moneyline:await load('moneyline-calibration-2026-10-28.json'),games:await load('game-robustness-2026-10-28.json'),points:await load('moneypuck-points-2025.json')};
const frozen=JSON.stringify(input),cards=scorecards(input),html=renderScorecard(input);
assert.equal(cards.length,9);assert.equal(cards[0].model,input.shots.modelBrier);assert.equal(cards[0].status,'No observed Brier advantage');assert.equal(cards[1].status,'No observed Brier advantage');assert.equal(cards[2].status,'Observed improvement · inconclusive');assert.equal(cards.at(-2).status,'Insufficient evidence');assert.equal(cards.at(-1).model,input.points.summary['negative-binomial'].brier);assert.equal(cards.at(-1).status,'Observed improvement · retrospective only');
for(const c of cards.slice(0,3))assert.equal(c.bins.reduce((n,b)=>n+b.n,0),Number.parseInt(c.sample));
assert.equal(comparisonStatus(NaN,.2), 'Insufficient evidence');assert.equal(comparisonStatus(.1,.2,{lower:.01,upper:.2}),'Observed improvement · retrospective only');assert.equal(comparisonStatus(.1,.2,{lower:0,upper:.2}),'Observed improvement · inconclusive');
assert(html.includes('Calibration · 30148 forecasts'));assert(html.includes('Unknown'));assert(html.includes('No model here has completed'));assert.equal(JSON.stringify(input),frozen);
const attack=structuredClone(input);attack.shots.modelVersion='<img src=x onerror=alert(1)>';assert(!renderScorecard(attack).includes('<img'));assert(renderScorecard(attack).includes('&lt;img'));
const page=await readFile(new URL('../paper.html',import.meta.url),'utf8');assert(page.includes(html));assert.equal(page.split('<!-- model-scorecard:start -->').length,2);
console.log('Scorecard: source figures, paired samples, calibration coverage, conservative labels, empty evidence, safe rendering and saved page parity passed.');

for(const g of input.games.markets){assert.equal(g.games,1167);assert.equal(g.calibration.reduce((n,b)=>n+b.n,0),g.games*(g.market==='h2h_3_way'?3:1));}assert(html.includes('outcome-class entries (three per game)'));
