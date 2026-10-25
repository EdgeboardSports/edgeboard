const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {handler}=require('../netlify/functions/nhl-game-log');
test('historical seasons and analytics fields survive the Netlify adapter', async()=>{
 const original=global.fetch; const urls=[];
 global.fetch=async url=>{urls.push(url);return Response.json(url.endsWith('/landing')?{currentSeason:20262027,firstName:{default:'Connor'},lastName:{default:'McDavid'}}:{gameLog:[{gameDate:'2025-10-10',opponentAbbrev:'TOR',homeRoadFlag:'H',goals:1,assists:2,points:3,shots:4}]});};
 try{
  const r=await handler({queryStringParameters:{playerId:'8478402',season:'20252026'}});
  assert.equal(r.statusCode,200);const d=JSON.parse(r.body);
  assert.equal(d.season,'20252026');assert.ok(urls[1].endsWith('/20252026/2'));
  assert.equal(d.games[0].homeRoadFlag,'H');assert.equal(d.games[0].opponentAbbrev,'TOR');
  assert.equal(d.games[0].homeAway,'H');assert.equal(d.last5.pointsPerGame,3);
  assert.equal(d.propHitRates.shotsOver2_5.last5.hits,1);
  const current=JSON.parse((await handler({queryStringParameters:{playerId:'8478402'}})).body);
  assert.equal(current.season,'20262027');
 }finally{global.fetch=original;}
});
test('invalid IDs and seasons are rejected before upstream requests',async()=>{
 for(const params of [{playerId:'bad'},{playerId:'8478402',season:'bad'},{playerId:'8478402',season:'20252027'}])assert.equal((await handler({queryStringParameters:params})).statusCode,400);
});
test('upstream failures remain structured 502 errors',async()=>{
 const original=global.fetch;global.fetch=async()=>new Response('',{status:503});
 try{assert.equal((await handler({queryStringParameters:{playerId:'8478402',season:'20252026'}})).statusCode,502);}finally{global.fetch=original;}
});
test('frontend uses the portable API namespace and Netlify rewrites it',()=>{
 const html=readFileSync('index.html','utf8');assert.ok(!html.includes('/.netlify/functions/'));
 const config=readFileSync('netlify.toml','utf8');assert.match(config,/from = "\/api\/\*"\s+to = "\/\.netlify\/functions\/:splat"\s+status = 200\s+force = true/);
});
