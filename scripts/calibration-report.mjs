import {readFile} from 'node:fs/promises';
import {fitGame,marketProbabilities} from '../game-model.js';
import {walkForwardCalibration} from '../game-calibration.js';
const before=process.argv[2];if(!/^\d{4}-\d{2}-\d{2}$/.test(before||'')||!Number.isFinite(Date.parse(before))||new Date(before).toISOString().slice(0,10)!==before)throw Error('Usage: node scripts/calibration-report.mjs YYYY-MM-DD (exclusive cutoff)');
const archive=JSON.parse(await readFile(new URL('../data/game-archive.json',import.meta.url),'utf8'));
const groups=new Map();let conflicts=0,duplicates=0;
for(const game of archive.games.filter(g=>g.date<before)){const key=String(game.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(game)}
const games=[];for(const copies of groups.values()){if(new Set(copies.map(r=>JSON.stringify(r))).size>1){conflicts++;continue}duplicates+=copies.length-1;games.push(copies[0])}
games.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
const rows=[];for(const game of games){if(!Number.isFinite(game.finalHome)||!Number.isFinite(game.finalAway)||game.finalHome===game.finalAway)continue;const model=fitGame(games,game.home,game.away,game.date);if(!model)continue;rows.push({id:game.id,date:game.date,trainingEnd:model.trainingEnd,probability:marketProbabilities(model,'h2h','Home').win,outcome:Number(game.finalHome>game.finalAway)})}
const report=walkForwardCalibration(rows);const {tests,...summary}=report;
console.log(JSON.stringify({cutoff:before,archiveAt:archive.generatedAt,archiveAudit:{conflicts,duplicates},eligibleForecasts:rows.length,...summary,firstTest:tests[0]?.date,lastTest:tests.at(-1)?.date,chronologyValid:tests.every(t=>t.trainingEnd<t.date&&t.calibrationTrainingEnd<t.date)},null,2));
