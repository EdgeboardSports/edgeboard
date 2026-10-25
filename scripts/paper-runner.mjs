import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {evaluate,VERSION} from '../shots-model.js';
import {seasonFor,completedBefore,cleanName} from '../prop-history.js';
import {freezePrediction,gradePrediction} from '../paper-core.js';
import {analyzeGame,gradeGame,GAME_VERSION} from '../game-model.js';
import {freezeGame} from '../game-paper.js';

const day=time=>new Date(time).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
export async function runPaper(ledger,client,{clock=()=>Date.now(),sourceCommit='local',maxGamesPerDay=2,gameArchive=null}={}){
 const started=clock(),errors=[],notes=[],cache=new Map();
 const get=path=>{if(!cache.has(path))cache.set(path,client(path));return cache.get(path)};
 // Existing shots and new game snapshots are graded independently.
 const saveGrade=(record,result)=>{const old={...record.result};delete old.gradedAt;if(JSON.stringify(old)!==JSON.stringify(result)){if(record.result.state!=='pending')record.resultHistory=[...(record.resultHistory||[]),record.result];record.result={...result,...(result.state==='pending'?{}:{gradedAt:new Date(clock()).toISOString()})}}};
 for(const event of ledger.events){
  const records=[...(event.records||[]),...(event.gameRecords||[])];if(!records.length||clock()-Date.parse(event.startTime)>14*86400000)continue;
  if(records.every(r=>r.result.state!=='pending')&&event.lastGradedAt&&clock()-Date.parse(event.lastGradedAt)<24*3600000)continue;
  try{
   const schedule=await get('/api/nhl-schedule?date='+event.date),game=(schedule.games||[]).find(g=>String(g.id)===String(event.nhlGameId));
   if(!game||!['FINAL','OFF'].includes(game.gameState))continue;
   for(const record of records)try{
    if(digest(record.snapshot)!==record.digest)throw Error('Snapshot integrity check failed for '+event.id);
    const s=record.snapshot;
    if(s.kind==='game'){saveGrade(record,gradeGame(s,game));continue}
    const season=seasonFor(event.startTime),log=await get('/api/nhl-game-log?'+new URLSearchParams({playerId:s.playerId,season}));
    if(!Array.isArray(log.games))throw Error('Invalid official game log');saveGrade(record,gradePrediction(s,game,log.games,clock()));
   }catch(e){errors.push('Grade '+event.id+': '+e.message)}
   event.lastGradedAt=new Date(clock()).toISOString();
  }catch(e){errors.push('Grade '+event.id+': '+e.message)}
 }
 // Event discovery itself uses no provider odds credits.
 let discovery;
 try{discovery=await get('/api/nhl-events');if(!Array.isArray(discovery.events))throw Error('Invalid event list')}
 catch(e){errors.push('Discovery: '+e.message);discovery={events:[]}}
 const remaining=discovery.remainingCredits==null?ledger.remainingCredits:Number(discovery.remainingCredits);
 if(Number.isFinite(Number(remaining))&&remaining!==null)ledger.remainingCredits=Number(remaining);
 const candidates=discovery.events.filter(e=>/^[a-f0-9]{32}$/.test(e.id||'')&&!ledger.events.some(old=>old.id===e.id)&&Date.parse(e.commenceTime)>started).sort((a,b)=>Date.parse(a.commenceTime)-Date.parse(b.commenceTime)||a.id.localeCompare(b.id));
 for(const candidate of candidates){
  const date=day(candidate.commenceTime);if(ledger.events.filter(e=>e.date===date).length>=maxGamesPerDay)continue;
  if(ledger.remainingCredits!=null&&ledger.remainingCredits<100){notes.push('Capture paused: observed provider quota below 100-credit reserve');break}
  if(Date.parse(candidate.commenceTime)-clock()>180*60000)continue;
  let schedule,game;
  try{
   schedule=await get('/api/nhl-schedule?date='+date);
   const name=t=>t?.name?.default||t?.commonName?.default;
   const matches=(schedule.games||[]).filter(g=>name(g.homeTeam)&&name(g.awayTeam)&&cleanName(candidate.homeTeam).endsWith(cleanName(name(g.homeTeam)))&&cleanName(candidate.awayTeam).endsWith(cleanName(name(g.awayTeam))));
   if(matches.length!==1){notes.push('Skipped event without unique NHL matchup '+candidate.id);continue}
   game=matches[0];
  }catch(e){errors.push('Schedule '+candidate.id+': '+e.message);continue}
  if(ledger.events.some(e=>String(e.nhlGameId)===String(game.id)))continue;
  if(game.gameType!==2){notes.push('Skipped non-regular-season game '+candidate.id);continue}
  const start=Math.min(Date.parse(candidate.commenceTime),Date.parse(game.startTimeUTC||candidate.commenceTime)),lead=start-clock();
  if(!Number.isFinite(start)||lead<15*60000||lead>180*60000||!['FUT','PRE'].includes(game.gameState))continue;
  const event={id:candidate.id,nhlGameId:game.id,date,startTime:new Date(start).toISOString(),homeTeam:candidate.homeTeam,awayTeam:candidate.awayTeam,modelVersion:VERSION,sourceCommit,capturedAt:new Date(clock()).toISOString(),records:[],excluded:[]};
  // Count the attempted game even if a feed fails: no selective retries based on results.
  ledger.events.push(event);
  try{
   const props=await get('/api/nhl-props?'+new URLSearchParams({event:event.id,market:'player_shots_on_goal'}));
   if(props.status!=='live'||!Array.isArray(props.odds))throw Error('Props feed unavailable');
   event.quotesFetchedAt=props.fetchedAt;if(props.remainingCredits!=null){event.remainingCredits=Number(props.remainingCredits);ledger.remainingCredits=event.remainingCredits}
   const quotes=new Map();
   for(const q of props.odds){const key=JSON.stringify([q.player,q.point,q.side]);if(!quotes.has(key)||q.decimal>quotes.get(key).decimal)quotes.set(key,q)}
   for(const quote of quotes.values()){
    try{
     const found=await get('/api/nhl-player-search?q='+encodeURIComponent(quote.player)),matches=(found.players||[]).filter(p=>cleanName(p.name)===cleanName(quote.player));
     if(matches.length!==1)throw Error('No unique player match');
     const player=matches[0],season=seasonFor(event.startTime),previous=String(Number(season.slice(0,4))-1)+season.slice(0,4);
     const current=await get('/api/nhl-game-log?'+new URLSearchParams({playerId:player.id,season}));
     if(!Array.isArray(current.games))throw Error('Current game log unavailable');
     let prior={games:[]};
     try{prior=await get('/api/nhl-game-log?'+new URLSearchParams({playerId:player.id,season:previous}))}catch{event.excluded.push({player:quote.player,reason:'Prior-season feed unavailable; current history only',informational:true})}
     const games=completedBefore([...current.games,...(prior.games||[])],date),venue=player.team===game.homeTeam.abbrev?'H':player.team===game.awayTeam.abbrev?'R':null,context={venue,opponent:venue==='H'?game.awayTeam.abbrev:venue==='R'?game.homeTeam.abbrev:null},analysis={result:evaluate(games,quote.point,context),context};
     const snapshot=freezePrediction({analysis,quote,event:{...event,commenceTime:event.startTime},player,capturedAt:new Date(clock()).toISOString(),sourceCommit,games});
     event.records.push({snapshot,digest:digest(snapshot),result:{state:'pending'}});
    }catch(e){event.excluded.push({player:quote.player,line:quote.point,side:quote.side,reason:e.message})}
   }
   event.status=event.records.length?'captured':'no_predictions';
  }catch(e){event.status='feed_error';event.error=e.message;errors.push('Capture '+event.id+': '+e.message)}
 }
 // Game markets are separate frozen records; existing shots snapshots never change.
 if(gameArchive?.games?.length&&gameArchive.generatedAt){
  for(const event of ledger.events){
   if(event.gameAttemptAt||(event.gameRecords||[]).length)continue;
   const lead=Date.parse(event.startTime)-clock();if(lead<15*60000||lead>180*60000)continue;
   if(ledger.remainingCredits!=null&&ledger.remainingCredits<103){notes.push('Game capture paused: reserve for three-market request');break}
   try{
    const schedule=await get('/api/nhl-schedule?date='+event.date),game=(schedule.games||[]).find(g=>String(g.id)===String(event.nhlGameId));if(!game||game.gameType!==2||!['FUT','PRE'].includes(game.gameState))continue;
    event.gameAttemptAt=new Date(clock()).toISOString();event.gameRecords=[];event.gameExcluded=[];
    const feed=await get('/api/nhl-game-odds?event='+event.id);if(feed.status!=='live'||!Array.isArray(feed.odds))throw Error('Game markets feed unavailable');
    event.gameQuotesFetchedAt=feed.fetchedAt;if(feed.remainingCredits!=null){ledger.remainingCredits=Number(feed.remainingCredits);event.gameRemainingCredits=ledger.remainingCredits}
    event.gameMarketsMissing=['h2h','spreads','h2h_3_way'].filter(m=>!feed.odds.some(q=>q.market===m));
    const quotes=new Map();for(const q of feed.odds){const key=JSON.stringify([q.market,q.side,q.point]);if(!quotes.has(key)||q.decimal>quotes.get(key).decimal)quotes.set(key,q)}
    const context={...event,homeAbbrev:game.homeTeam.abbrev,awayAbbrev:game.awayTeam.abbrev,verified:true};
    for(const quote of quotes.values())try{
     const analysis=analyzeGame(gameArchive,context,quote),snapshot=freezeGame({analysis,quote,event:context,capturedAt:new Date(clock()).toISOString(),sourceCommit});
     event.gameRecords.push({snapshot,digest:digest(snapshot),result:{state:'pending'}});
    }catch(e){event.gameExcluded.push({market:quote.market,side:quote.side,line:quote.point,reason:e.message})}
    event.gameStatus=event.gameRecords.length?'captured':'no_predictions';
   }catch(e){event.gameStatus='feed_error';event.gameError=e.message;errors.push('Game capture '+event.id+': '+e.message)}
  }
 }else notes.push('Game-market capture paused: team archive is not ready');

 ledger.policy={...(ledger.policy||{}),gameMarkets:['h2h','spreads','h2h_3_way'],gameModelVersion:GAME_VERSION,selection:'Best-price shots and game selections in up to two sampled games per day, including failed checks. No post-start backfill.',gameCreditsPerUncachedEvent:3};
 ledger.lastRunAt=new Date(clock()).toISOString();ledger.updatedAt=ledger.lastRunAt;
 ledger.runs=[...(ledger.runs||[]),{at:ledger.lastRunAt,sourceCommit,errors,notes,capturedGames:ledger.events.filter(e=>Date.parse(e.capturedAt)>=started).length}].slice(-48);
 return ledger;
}
export function makeClient(base,{fetchImpl=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const official=path=>{
  const u=new URL(path,'https://edgeboard.invalid'),p=u.searchParams;
  if(u.pathname==='/api/nhl-schedule'&&/^\d{4}-\d{2}-\d{2}$/.test(p.get('date')||''))return {url:'https://api-web.nhle.com/v1/score/'+p.get('date'),normalize:d=>({games:d.games||[]})};
  if(u.pathname==='/api/nhl-game-log'&&/^\d{7}$/.test(p.get('playerId')||'')&&/^\d{8}$/.test(p.get('season')||''))return {url:'https://api-web.nhle.com/v1/player/'+p.get('playerId')+'/game-log/'+p.get('season')+'/2',normalize:d=>({games:d.gameLog||[]})};
  if(u.pathname==='/api/nhl-player-search'&&(p.get('q')||'').length>=2)return {url:'https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=50&q='+encodeURIComponent(p.get('q')),normalize:d=>({players:(Array.isArray(d)?d:[]).map(x=>({id:String(x.playerId||''),name:x.name||'',team:x.teamAbbrev||'',position:x.positionCode||'',active:x.active===true})).filter(x=>/^\d{7}$/.test(x.id)&&x.name.toLowerCase().includes(p.get('q').toLowerCase()))})};
  return null;
 };
 return async path=>{
  let last;const attempts=(path.startsWith('/api/nhl-props?')||path.startsWith('/api/nhl-game-odds?'))?1:3;
  for(let i=0;i<attempts;i++){
   try{const r=await fetchImpl(base+path,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('HTTP '+r.status+' for '+path.split('?')[0]);return await r.json()}catch(e){last=e;if(i+1<attempts)await pause(1000*(i+1))}
  }
  const fallback=official(path);
  if(fallback){const r=await fetchImpl(fallback.url,{signal:AbortSignal.timeout(20000),headers:{Accept:'application/json'}});if(!r.ok)throw Error('Both app and official NHL feeds unavailable: official HTTP '+r.status);return fallback.normalize(await r.json())}
  throw last;
 };
}
async function main(){
 const base=(process.env.EDGEBOARD_URL||'https://edgeboard-8fl.pages.dev').replace(/\/$/,'');
 const client=makeClient(base);
 const path=new URL('../data/paper-ledger.json',import.meta.url);const ledger=JSON.parse(await readFile(path,'utf8'));
 let gameArchive=null;try{gameArchive=JSON.parse(await readFile(new URL('../data/game-archive.json',import.meta.url),'utf8'))}catch{}
 const result=await runPaper(ledger,client,{gameArchive,sourceCommit:process.env.PAPER_SOURCE_COMMIT||process.env.GITHUB_SHA||'local'});
 await mkdir(new URL('../data/',import.meta.url),{recursive:true});await writeFile(path,JSON.stringify(result,null,2)+'\n');
 const last=result.runs.at(-1);console.log(JSON.stringify({lastRunAt:result.lastRunAt,capturedGames:last.capturedGames,totalEvents:result.events.length,totalPredictions:result.events.reduce((n,e)=>n+e.records.length,0),gamePredictions:result.events.reduce((n,e)=>n+(e.gameRecords||[]).length,0),errors:last.errors,notes:last.notes}));
 if(last.errors.length)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();
