import assert from 'node:assert/strict';
import {advancedBacktest} from '../scripts/shots-advanced.mjs';
const rows=[];
for(let i=0;i<90;i++){
 const date=new Date(Date.UTC(2024,9,i+1)).toISOString().slice(0,10).replaceAll('-','');
 const gameId='202402'+String(i+1).padStart(4,'0');
 for(let team=0;team<2;team++){
  for(let p=0;p<3;p++){
   const playerId=String(8470001+team*3+p);
   const base={playerId,season:'2024',gameId,gameDate:date,
    playerTeam:team?'BOS':'NYR',opposingTeam:team?'NYR':'BOS',
    home_or_away:team?'AWAY':'HOME'};
   rows.push({...base,situation:'all',icetime:'1100',I_F_shotsOnGoal:String((i+p+team)%5)});
   rows.push({...base,situation:'5on4',icetime:String(30+((i+p)%4)*40),I_F_shotsOnGoal:'0'});
  }
 }
}
import {normalizeGameRows} from '../scripts/moneypuck-backtest.mjs';
for(const row of rows.filter(r=>r.situation==='all')){try{normalizeGameRows([row],{season:2024})}catch(e){console.error('Invalid synthetic test row:',JSON.stringify(row));throw e}}
const report=advancedBacktest(rows,{season:2024,cutoff:'2025-07-01',developmentEnd:'2024-12-01'});
assert.equal(report.checks.chronologyValid,true);
assert(report.checks.development>0&&report.checks.later>0);
assert(report.checks.opponentAvailable>0&&report.checks.ppAvailable>0);
assert.equal(report.development.simplified.n,report.development.combined.n);
assert.equal(report.laterEvaluation.simplified.n,report.laterEvaluation.combined.n);
assert(report.selectedOnDevelopment in report.development);
assert(report.uncertainty.combined.simplifiedMinusVariant95.length===2);
assert.throws(()=>advancedBacktest(rows,{season:2024,cutoff:'2024-12-01',developmentEnd:'2024-12-01'}));
console.log('Advanced shots research: historical opponent/PP features, chronological split, fixed variants and uncertainty passed');
