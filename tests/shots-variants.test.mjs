import assert from 'node:assert/strict';
import {normalizeGameRows,moneyPuckShotBacktest} from '../scripts/moneypuck-backtest.mjs';
import {compareVariants} from '../scripts/shots-variants.mjs';
const rows=Array.from({length:70},(_,i)=>({
 playerId:'8470001',season:'2025',gameId:'202502'+String(i+1).padStart(4,'0'),
 gameDate:new Date(Date.UTC(2025,9,i+1)).toISOString().slice(0,10).replaceAll('-',''),
 playerTeam:'NYR',opposingTeam:i%3?'BOS':'CAR',home_or_away:i%2?'HOME':'AWAY',
 icetime:String(900+i%5*60),I_F_shotsOnGoal:String((i*3)%6)
}));
const imported=normalizeGameRows(rows,{season:2025});
const comparison=compareVariants(imported,{before:'2026-07-01',developmentEnd:'2025-11-20'});
const reference=moneyPuckShotBacktest(imported,{before:'2026-07-01'});
assert.equal(comparison.checks.total,reference.forecasts);
assert.equal(comparison.checks.development+comparison.checks.laterEvaluation,reference.forecasts);
assert(comparison.checks.development>0&&comparison.checks.laterEvaluation>0);
assert(comparison.checks.chronologyValid);
assert.equal(Object.keys(comparison.variantDefinitions).length,5);
const totalOriginal=(comparison.development.original.brier*comparison.checks.development+comparison.laterEvaluation.original.brier*comparison.checks.laterEvaluation)/comparison.checks.total;
assert(Math.abs(totalOriginal-reference.modelBrier)<1e-7);
assert(comparison.selectedOnDevelopment in comparison.variantDefinitions);
assert.equal(comparison.laterEvaluation.original.n,comparison.laterEvaluation.baseline.n);
assert(comparison.selectedLaterUncertainty.baselineMinusVariant95.length===2);
assert.throws(()=>compareVariants(imported,{before:'2025-11-20',developmentEnd:'2025-11-20'}));
console.log('Five-variant comparison: original reproduction, five fixed variants, chronological split, uncertainty and selection passed');
