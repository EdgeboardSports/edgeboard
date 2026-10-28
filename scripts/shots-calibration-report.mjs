import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {normalizeGameRows,moneyPuckShotBacktest} from './moneypuck-backtest.mjs';
import {calibrateShots} from './shots-calibration.mjs';
const [season,before,path]=process.argv.slice(2);
if(!/^\d{4}$/.test(season||'')||!/^\d{4}-\d{2}-\d{2}$/.test(before||'')||!path)throw Error('Usage: node scripts/shots-calibration-report.mjs SEASON BEFORE SKATER_ZIP');
const decoded=JSON.parse(execFileSync('python3',[fileURLToPath(new URL('./moneypuck-game-rows.py',import.meta.url)),path,season],{encoding:'utf8',maxBuffer:64*1024*1024,timeout:120000}));
const raw=moneyPuckShotBacktest(normalizeGameRows(decoded.rows,{season:Number(season)}),{before,includeTests:true,allTests:true});
console.log(JSON.stringify({attribution:raw.attribution,sourceUrl:raw.sourceUrl,archiveSha256:decoded.sha256,before,line:raw.line,sourceForecasts:raw.forecasts,sampling:"Every eligible appearance after 20 prior games; no latest-game truncation",...calibrateShots(raw.tests)},null,2));
