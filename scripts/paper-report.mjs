import {readFile} from 'node:fs/promises';
import {evaluationWindow} from '../evaluation-core.js';
const ledger=JSON.parse(await readFile(new URL('../data/paper-ledger.json',import.meta.url),'utf8'));
const records=(ledger.events||[]).flatMap(e=>[...(e.records||[]),...(e.gameRecords||[])]);
console.log(JSON.stringify(evaluationWindow(records,{start:process.argv[2]}),null,2));
