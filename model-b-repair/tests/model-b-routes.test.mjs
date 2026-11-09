import {modelBModel as shadowModel,loadModelBRecords as loadShadowRecords,modelBSlateCoverage as shadowSlateCoverage} from '../worker/model-b-selection.js';
import {shadowBlend,shadowProbabilityMetrics} from '../worker/shadow-core.js';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
import {officialPaper,officialBoard} from '../worker/official-paper.js';import {forwardAppend,forwardHash} from '../worker/forward-testing.js';import {puckApiGrading} from '../worker/puckapi-grading.js';import {poissonScoreGrid} from '../worker/experimental-model.js';
const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE collector_evidence(id TEXT PRIMARY KEY,namespace TEXT,event_id TEXT,captured_at TEXT,payload TEXT,digest TEXT)');const DB={prepare(q){const statement=(a=[])=>({bind:(...v)=>statement(v),run:async()=>({meta:{changes:Number(db.prepare(q).run(...a).changes)}}),first:async()=>db.prepare(q).get(...a),all:async()=>({results:db.prepare(q).all(...a)})});return statement()}};
const now=Date.parse('2026-10-30T20:00:00Z'),startAt=new Date(now+2*3600000).toISOString();let clock=now;
const stats=JSON.parse(readFileSync('data/moneypuck-team-goalies-2026.json')),audit=JSON.parse(readFileSync('data/team-cutoff-audit.json'));stats.goalies.downloadedAt=new Date(now-1000).toISOString();stats.teams.downloadedAt=new Date(now-1000).toISOString();audit.summarySha256=stats.teams.sourceSha256;for(const t of stats.teams.records)audit.teams[t.team]={reconciled:true,lastIncludedGameDate:'2026-10-29',games:t.situations.all.gamesPlayed};
await forwardAppend(DB,'stats','forward-research-inputs',null,{stats,audit},now-1000);
const fixtures=[['Carolina Hurricanes','New York Rangers','CAR','NYR'],['Boston Bruins','Vegas Golden Knights','BOS','VGK'],['Florida Panthers','Chicago Blackhawks','FLA','CHI']];
const events=fixtures.map((t,i)=>({id:String(i+1).repeat(32),home:t[0],away:t[1],startAt,books:[{key:'draftkings',markets:[{key:'h2h',updatedAt:new Date(now-500).toISOString(),outcomes:[{name:t[0],price:400},{name:t[1],price:-500}]}]}]}));
await forwardAppend(DB,'odds','free-odds-cache',null,{fetchedAt:new Date(now-500).toISOString(),providerRemainingCredits:490,events},now-500);
const legacyGrid=poissonScoreGrid(3,2.5),legacy={protocol:'dk-moneyline-favorite-paper-v1',eventId:'f'.repeat(32),home:fixtures[0][0],away:fixtures[0][1],startAt:'2026-10-29T22:10:00.000Z',capturedAt:'2026-10-29T20:00:00.000Z',homeProbability:legacyGrid.regulation.home+legacyGrid.regulation.draw/2,bookHomeNoVig:.5,selection:'home',decimal:2,stakeUnits:1,candidate:false,modelInputs:{homeLambda:3,awayLambda:2.5}};
await forwardAppend(DB,'legacy','forward-v1-predictions',legacy.eventId,legacy,Date.parse(legacy.capturedAt));
const games=fixtures.map((t,i)=>({id:'202602999'+i,season:'20262027',gameType:'regular',gameDate:'2026-10-30',homeTeam:t[2],awayTeam:t[3],gameState:'FUT',sourceStartTime:startAt,homeScore:null,awayScore:null}));
games.push({id:'2026020100',season:'20262027',gameType:'regular',gameDate:'2026-10-29',homeTeam:'CAR',awayTeam:'NYR',gameState:'OFF',sourceStartTime:'2026-10-29T22:00:00.000Z',homeScore:3,awayScore:2});
async function source(id,rows,time){const snapshot={retrievedAt:new Date(time).toISOString(),sourceResponseSha256:'e'.repeat(64),games:rows};await forwardAppend(DB,id,'puckapi-v1-receipts',null,{provider:'PuckAPI',receivedAt:new Date(time).toISOString(),snapshot,upstreamDigest:await forwardHash(JSON.stringify(snapshot))},time)}await source('puck',games,now-100);
const req=(body,path='/collector/api/official-paper')=>new Request('https://test'+path,body?{method:'POST',headers:{Origin:'https://test','Content-Type':'application/json'},body:JSON.stringify(body)}:{});
const rules={book:'draftkings',market:'h2h',status:'documented',version:'fixture-v1',reviewedAt:new Date(now-10000).toISOString(),expiresAt:new Date(now+31*86400000).toISOString()},ctx={rules,modelCodeHash:'a'.repeat(64),clock:()=>clock,modelBCodeHash:'c'.repeat(64)};
const env={DB,PAPER_TRIAL_SCHEDULE_PROOF:JSON.stringify({id:'fixture-schedule',is_enabled:true,verifiedAt:new Date(now).toISOString(),coverageThrough:new Date(now+31*86400000).toISOString()})};
const shadowReq=(body={},phase='')=>req(body,'/collector/api/shadow-model'+phase);
assert.equal((await shadowModel(shadowReq(),env,ctx,clock)).status,409);
assert.equal(db.prepare("SELECT COUNT(*) n FROM collector_evidence WHERE namespace LIKE 'official-paper%'").get().n,0);
const protocol={...JSON.parse(readFileSync('docs/shadow-audit-baseline.json')).officialProtocol,id:'fixture-only',modelCodeHash:ctx.modelCodeHash,startAt:new Date(now-1000).toISOString(),endAt:new Date(now+30*86400000).toISOString(),scheduleCoverageThrough:new Date(now+31*86400000).toISOString()};
await forwardAppend(DB,'official-fixture','official-paper-v2-protocols',protocol.id,protocol,now-1000);
await forwardAppend(DB,'refresh-ok','forward-research-status',null,{held:false},now-1000);
for(const team of fixtures.flatMap(t=>[t[2],t[3]])){const g=stats.goalies.records.find(g=>g.team===team),e=events.find(e=>e.home===fixtures.find(t=>t.includes(team))?.[0]&&e.away===fixtures.find(t=>t.includes(team))?.[1]);await forwardAppend(DB,'claim:'+team,'pregame-v1-evidence',e.id,{kind:'goalie_confirmed',team,playerId:g.playerId,eventId:e.id,home:e.home,away:e.away,startAt:e.startAt,sourcePublishedAt:new Date(now-1000).toISOString(),capturedAt:new Date(now-500).toISOString(),sourceHtmlSha256:'d'.repeat(64)},now-500);}

const built=(await import('../dist/server/index.js?test=routes')).default;
const originalNow=Date.now;Date.now=()=>clock;
const originalFetch=globalThis.fetch;globalThis.fetch=()=>{throw Error('No provider calls allowed')};
for(const path of ['/collector/api/model-b','/collector/api/shadow-factors']){
 const response=await built.fetch(req(null,path),env);assert.equal(response.status,200,await response.clone().text());const data=await response.json();assert.equal(data.version,'factor-b-v4');assert(data.rankings);}
let response=await built.fetch(req({},'/collector/api/shadow-factors'),env);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).version,'factor-b-v4');
response=await built.fetch(req({},'/collector/api/shadow-notification/b'),env);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).packet.version,'factor-b-v4');
assert.equal((await built.fetch(new Request('https://test/collector/api/shadow-factors',{method:'POST',headers:{Origin:'https://evil','Content-Type':'application/json'},body:'{}'}),env)).status,403);
assert.equal((await built.fetch(req(null,'/collector/api/shadow-factors?bad=1'),env)).status,400);
Date.now=originalNow;globalThis.fetch=originalFetch;db.close();console.log('Built Worker routing: active B GET/POST, explicit B route, B notifications, auth and query rejection passed');
