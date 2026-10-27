import {readFile} from 'node:fs/promises';
import {goalieBacktest} from '../goalie-backtest.js';
const archive=JSON.parse(await readFile(new URL('../data/game-archive.json',import.meta.url),'utf8'));
// Optional local evidence file. No download and no production collection are performed.
const snapshots=process.argv[3]?JSON.parse(await readFile(process.argv[3],'utf8')):[];
console.log(JSON.stringify(goalieBacktest(archive,snapshots,{before:process.argv[2]}),null,2));
