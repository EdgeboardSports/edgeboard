import assert from 'node:assert/strict';
import {fitCount,compareCounts} from '../count-model.js';
const rows=Array.from({length:60},(_,i)=>({gameId:i,gameDate:new Date(Date.UTC(2025,0,i+1)).toISOString().slice(0,10),shots:i%6,points:i%3===0?2:0,toi:'20:00'}));
const opts={before:'2026-01-01'};
assert.throws(()=>fitCount(rows),/cutoff/);
assert.equal(fitCount(rows.slice(0,19),opts),null);
const shots=fitCount(rows,opts),points=fitCount(rows,{...opts,stat:'points'});assert.notEqual(shots.mean,points.mean);assert.equal(shots.expectedMinutes,20);
assert.equal(fitCount([...rows,{gameDate:'2026-01-01',shots:999}],opts).mean,shots.mean);
assert.equal(fitCount([...rows,rows[0]],opts).sample,60);
const result=compareCounts(rows,{...opts,line:2.5});assert.equal(result.tests.length,40);assert(result.tests.every(t=>Object.values(t.scores).every(s=>s.trainingEnd<t.date)));assert.equal(result.promoted,false);
const changed=rows.map((g,i)=>i===59?{...g,shots:99}:g),other=compareCounts(changed,{...opts,line:2.5});assert.deepEqual(result.tests.at(-1).scores.poisson.probability,other.tests.at(-1).scores.poisson.probability);
assert(Number.isFinite(result.summary.poisson.logLoss));
console.log('Passed count challengers: distinct points, exposure normalization, minimum samples, deduplication, leakage exclusion and chronological distribution comparison.');

assert.equal(result.summary['shots-v1'].n,40);assert.throws(()=>compareCounts(rows,{line:2.5}),/cutoff/);

// Baseline and calibration must use the same held-out targets without target leakage.
assert.equal(result.summary.empirical.n,40);
assert.equal(result.summary.empirical.brierSkill,0);
assert.deepEqual(result.tests.at(-1).scores.empirical,other.tests.at(-1).scores.empirical);
for(const score of Object.values(result.summary)){
 assert.equal(score.overCalibration.reduce((s,b)=>s+b.n,0),score.n);
 assert(Number.isFinite(score.brierSkill));
 for(const b of score.overCalibration){if(b.n){assert(b.predicted>=b.lower&&b.predicted<=b.upper);assert(b.observed>=0&&b.observed<=1)}else{assert.equal(b.predicted,null);assert.equal(b.observed,null)}}
}
const empty=compareCounts(rows.slice(0,20),{...opts,line:2});
assert.equal(empty.summary.poisson.brierSkill,null);
assert(empty.summary.poisson.overCalibration.every(b=>b.n===0&&b.observed===null));
for(const line of [2,2.5]){
 const report=compareCounts(rows,{...opts,line});
 for(const t of report.tests){const p=t.scores.empirical.probability;assert(Math.abs(p.over+p.under+p.push-1)<1e-12);if(!Number.isInteger(line))assert.equal(p.push,0)}
}
assert.throws(()=>compareCounts(rows,{...opts,stat:'invalid',line:2.5}),/statistic/);
console.log('Passed paired empirical baseline, Brier skill, calibration bins, push handling, empty samples and target-outcome isolation.');
