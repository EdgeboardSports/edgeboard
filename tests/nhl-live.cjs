// Opt-in integration checks: uses real NHL APIs, no credentials required.
const assert=require('node:assert/strict');
const {readFileSync,readdirSync}=require('node:fs');
(async()=>{
 let count=0;
 for(const platform of ['netlify','cloudflare']){
 const dir=platform==='netlify'?'netlify/functions':'functions/api';
 for(const file of readdirSync(dir).filter(f=>f.endsWith('.js'))){
  const name=file.slice(0,-3);
  const params={date:'2026-10-24',q:'McDavid',playerId:'8478402',season:'20252026'};
  let status,d;
  if(platform==='netlify'){
   const r=await require('../'+dir+'/'+file).handler({queryStringParameters:params});status=r.statusCode;d=JSON.parse(r.body);
  }else{
   const mod=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(dir+'/'+file)).toString('base64'));
   const r=await mod.onRequestGet({request:new Request('https://edgeboard.test/api/'+name+'?'+new URLSearchParams(params))});status=r.status;d=await r.json();
  }
  assert.equal(status,200,JSON.stringify({platform,name,d}));
  const key=name==='nhl-stats'?'standings':name==='nhl-player-search'?'players':name==='nhl-players'?'points':'games';
  assert.ok(Array.isArray(d[key])&&d[key].length>0,`${platform}/${name} missing data`);
  if(name==='nhl-players')for(const k of ['goals','assists'])assert.ok(d[k].length>0);
  if(name==='nhl-game-log'){
   assert.equal(d.season,'20252026');assert.equal(d.games.length,82);
   assert.ok(d.games.every(g=>['H','R'].includes(g.homeRoadFlag)&&g.opponentAbbrev));
  }
  console.log(`PASS ${platform}/${name}: ${d[key].length} ${key}`);count++;
 }
 }
 console.log(`${count} live endpoint checks passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
