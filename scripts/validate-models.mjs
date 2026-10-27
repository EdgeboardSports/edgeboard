import {readFile} from 'node:fs/promises';
import {gameBacktest,GAME_VERSION} from '../game-model.js';
const archive=JSON.parse(await readFile(new URL('../data/game-archive.json',import.meta.url),'utf8'));
// No odds are synthesized. This evaluates probability accuracy, never betting ROI.
const before=process.argv[2];if(!/^\d{4}-\d{2}-\d{2}$/.test(before||''))throw Error('Usage: node scripts/validate-models.mjs YYYY-MM-DD (exclusive cutoff)');
const rows=[['h2h','Home',null],['h2h_3_way','Draw',null],['spreads','Home',-1.5],['totals','Over',6.5]].map(([market,side,line])=>{
 const t=gameBacktest(archive,market,side,line,before);return {market,side,line,games:t.games,brier:t.brier,baseline:t.baseline,first:t.tests.at(-1)?.date,last:t.tests[0]?.date,chronologyValid:t.tests.every(x=>x.trainingEnd<x.date)};
});
console.log(JSON.stringify({model:GAME_VERSION,cutoff:before,archiveAt:archive.generatedAt,markets:rows,limitations:['At most 100 recent holdout games per market','Fixed illustrative total/spread; no historical odds or ROI','Equal-strength baseline is not a sportsbook baseline','No evidence of calibrated recommendation strength from this test alone']},null,2));
