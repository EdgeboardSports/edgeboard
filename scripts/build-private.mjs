import {mkdir,rm,copyFile} from 'node:fs/promises';
import {dirname} from 'node:path';
const root=new URL('../',import.meta.url),out=new URL('../dist/',import.meta.url);
const files=['index.html','best-picks.html','game.html','game-markets.html','player.html','paper.html','props.html','odds.html','best-picks-engine.js','game-model.js','game-paper.js','game-day.js','paper-core.js','prop-history.js','quote-selection.js','research-context.js','shots-model.js','count-model.js','evaluation-core.js','assets/ui.css','assets/ui.js','assets/best-picks.js','data/game-archive.json','data/paper-ledger.json','_routes.json'];
// This script's fixed output path is never taken from user input.
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const path of files){const target=new URL(path,out);await mkdir(dirname(target.pathname),{recursive:true});await copyFile(new URL(path,root),target)}
console.log('Prepared '+files.length+' intended assets. Activate only after Access and Pages Fail closed are verified.');
