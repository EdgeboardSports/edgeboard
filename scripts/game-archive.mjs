import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {seasonFor} from '../prop-history.js';
import {normalizeGame} from '../game-model.js';
export async function buildArchive(old,read,{now=Date.now()}={}){
 if(old.generatedAt&&!old.errors?.length&&now-Date.parse(old.generatedAt)<12*3600000)return old;
 const current=seasonFor(new Date(now).toISOString()),prior=String(Number(current.slice(0,4))-1)+current.slice(0,4),errors=[],data=await read('https://api-web.nhle.com/v1/standings/now');
 const teams=[...new Set((data.standings||[]).map(x=>x.teamAbbrev?.default||x.teamAbbrev).filter(x=>/^[A-Z]{3}$/.test(x)))];if(teams.length<30)throw Error('NHL team list incomplete');
 const seasons=old.seasons?.includes(prior)&&!old.errors?.length?[current]:[prior,current],games=new Map((old.games||[]).filter(g=>!seasons.includes(String(g.season))).map(g=>[String(g.id),g]));
 const tasks=seasons.flatMap(season=>teams.map(team=>({team,season})));let next=0;
 await Promise.all(Array.from({length:4},async()=>{while(next<tasks.length){const {team,season}=tasks[next++];try{
  const d=await read('https://api-web.nhle.com/v1/club-schedule-season/'+team+'/'+season);
  if(!Array.isArray(d.games))throw Error('Invalid team schedule');for(const raw of d.games){const g=normalizeGame(raw);if(g)games.set(String(g.id),g)}
 }catch(e){errors.push(team+' '+season+': '+e.message)}}}));
 return {schemaVersion:1,generatedAt:new Date(now).toISOString(),seasons:[prior,current],teams,teamNames:Object.fromEntries((data.standings||[]).map(x=>[x.teamAbbrev?.default||x.teamAbbrev,x.teamName?.default||x.teamName]).filter(([k,v])=>teams.includes(k)&&typeof v==='string')),games:[...games.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id),errors};
}
export async function readOfficial(url){
 let last;for(let i=0;i<3;i++)try{const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('Official NHL HTTP '+r.status);return await r.json()}catch(e){last=e;if(i<2)await new Promise(r=>setTimeout(r,1000*(i+1)))}throw last;
}
async function main(){const path=new URL('../data/game-archive.json',import.meta.url),old=JSON.parse(await readFile(path,'utf8')),next=await buildArchive(old,readOfficial);await writeFile(path,JSON.stringify(next)+'\n');console.log(JSON.stringify({archiveAt:next.generatedAt,teams:next.teams.length,games:next.games.length,errors:next.errors}));if(next.errors.length)process.exitCode=1}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
