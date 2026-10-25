import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {seasonFor} from '../prop-history.js';
import {normalizeGame} from '../game-model.js';
export async function buildArchive(old,read,{now=Date.now(),pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 if(old.nextRetryAt&&now<Date.parse(old.nextRetryAt))return old;
 if(old.generatedAt&&!old.errors?.length&&now-Date.parse(old.generatedAt)<12*3600000)return old;
 const current=seasonFor(new Date(now).toISOString()),prior=String(Number(current.slice(0,4))-1)+current.slice(0,4),errors=[],data=await read('https://api-web.nhle.com/v1/standings/now');
 const teams=[...new Set((data.standings||[]).map(x=>x.teamAbbrev?.default||x.teamAbbrev).filter(x=>/^[A-Z]{3}$/.test(x)))];if(teams.length<30)throw Error('NHL team list incomplete');
 const partial=old.errors?.length&&old.generatedAt&&now-Date.parse(old.generatedAt)<12*3600000;
 const missing=partial?[...new Map(old.errors.map(e=>/^([A-Z]{3}) (\d{8}):/.exec(e)).filter(Boolean).map(m=>[m[1]+m[2],{team:m[1],season:m[2]}])).values()]:[];
 const seasons=old.seasons?.includes(prior)&&!old.errors?.length?[current]:[prior,current],retryOnly=missing.length>0,tasks=retryOnly?missing:seasons.flatMap(season=>teams.map(team=>({team,season})));
 const games=new Map((old.games||[]).filter(g=>retryOnly||!seasons.includes(String(g.season))).map(g=>[String(g.id),g]));let limited=false,nextRetryAt=null;
 for(const {team,season}of tasks){
  if(limited){errors.push(team+' '+season+': Deferred after NHL rate limit');continue}
  await pause(2000);
  try{const d=await read('https://api-web.nhle.com/v1/club-schedule-season/'+team+'/'+season);if(!Array.isArray(d.games))throw Error('Invalid team schedule');for(const raw of d.games){const g=normalizeGame(raw);if(g)games.set(String(g.id),g)}}
  catch(e){errors.push(team+' '+season+': '+e.message);if(e.status===429){limited=true;nextRetryAt=new Date(now+(e.retryAfterSeconds||120)*1000).toISOString()}}
 }
 return {schemaVersion:1,generatedAt:new Date(now).toISOString(),seasons:[prior,current],teams,teamNames:Object.fromEntries((data.standings||[]).map(x=>[x.teamAbbrev?.default||x.teamAbbrev,x.teamName?.default||x.teamName]).filter(([k,v])=>teams.includes(k)&&typeof v==='string')),games:[...games.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id),errors,...(nextRetryAt?{nextRetryAt}:{})};
}
export async function readOfficial(url){
 let last;for(let i=0;i<3;i++)try{
  const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)});
  if(!r.ok){const e=Error('Official NHL HTTP '+r.status);e.status=r.status;if(r.status===429){const h=r.headers.get('retry-after'),seconds=Number(h);e.retryAfterSeconds=h&&Number.isFinite(seconds)?Math.max(1,seconds):h&&Number.isFinite(Date.parse(h))?Math.max(1,Math.ceil((Date.parse(h)-Date.now())/1000)):120;throw e}throw e}
  return await r.json();
 }catch(e){if(e.status===429)throw e;last=e;if(i<2)await new Promise(r=>setTimeout(r,1000*(i+1)))}throw last;
}
async function main(){const path=new URL('../data/game-archive.json',import.meta.url),old=JSON.parse(await readFile(path,'utf8')),next=await buildArchive(old,readOfficial);await writeFile(path,JSON.stringify(next)+'\n');console.log(JSON.stringify({archiveAt:next.generatedAt,teams:next.teams.length,games:next.games.length,errors:next.errors,nextRetryAt:next.nextRetryAt}));if(next.errors.length)process.exitCode=1}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
