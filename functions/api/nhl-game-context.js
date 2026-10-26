const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const espnTeam=t=>({LAK:'LA',NJD:'NJ',SJS:'SJ',TBL:'TB',UTA:'UTAH'}[t]||t);
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json','Cache-Control':status===200?'public, max-age=60':'no-store'}});
async function read(url){const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Source unavailable');return r.json()}
export function goalieStatus(competitor,roster){
 const unknown={status:'unknown',name:null,playerId:null,source:'ESPN pregame probable starters'};
 const entries=(competitor?.probables||[]).filter(p=>p.name==='probableStartingGoalie');if(entries.length!==1||!Array.isArray(roster?.goalies))return unknown;
 const p=entries[0],athlete=p.athlete;if(!athlete||String(athlete.team?.id)!==String(competitor.team?.id)||athlete.position!=='G')return unknown;
 const full=athlete.fullName||athlete.displayName,matches=roster.goalies.filter(g=>clean([g.firstName?.default,g.lastName?.default].filter(Boolean).join(' '))===clean(full)&&(!athlete.jersey||String(g.sweaterNumber)===String(athlete.jersey)));
 if(matches.length!==1||!/^\d{7}$/.test(String(matches[0].id)))return unknown;
 const status=p.status?.type==='confirmed'?'confirmed':['expected','probable','projected'].includes(p.status?.type)?'projected':'unknown';
 return {status,name:full,playerId:String(matches[0].id),providerStatus:p.status?.name||null,source:'ESPN pregame probable starters',sourceUpdatedAt:null};
}
export function matchProviderEvent(data,game){
 const matches=(data?.events||[]).filter(e=>{
  const c=e.competitions?.[0],teams=c?.competitors||[],home=teams.find(t=>t.homeAway==='home'),away=teams.find(t=>t.homeAway==='away');
  return home?.team?.abbreviation===espnTeam(game.homeTeam.abbrev)&&away?.team?.abbreviation===espnTeam(game.awayTeam.abbrev)&&Math.abs(Date.parse(e.date)-Date.parse(game.startTimeUTC))<=15*60000;
 });return matches.length===1?matches[0]:null;
}
export function normalizeScratches(rail,side){
 const entries=rail?.gameInfo?.[side+'Team']?.scratches;
 if(!Array.isArray(entries))return {status:'unknown',players:[]};
 const players=entries.filter(p=>/^\d{7}$/.test(String(p.id))).map(p=>({id:String(p.id),name:[p.firstName?.default,p.lastName?.default].filter(Boolean).join(' ')}));
 return {status:players.length?'reported':'unknown',players,source:'NHL game report',completeLineup:false};
}
export async function onRequestGet({request}){
 const id=new URL(request.url).searchParams.get('gameId');if(!/^\d{10}$/.test(id||''))return json({message:'Valid NHL game ID required'},400);
 const cache=typeof caches!=='undefined'?caches.default:null,key=new Request(new URL('/api/nhl-game-context?gameId='+id,request.url));
 const cached=cache?await cache.match(key):null;if(cached)return cached;
 try{
  const game=await read('https://api-web.nhle.com/v1/gamecenter/'+id+'/landing');
  if(String(game.id)!==id||game.gameType!==2||!/^\d{4}-\d{2}-\d{2}$/.test(game.gameDate||'')||!['homeTeam','awayTeam'].every(k=>/^[A-Z]{3}$/.test(game[k]?.abbrev||'')))throw Error('Game identity unavailable');
  const now=Date.now(),date=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'}),pregame=game.gameDate===date&&['FUT','PRE'].includes(game.gameState)&&Date.parse(game.startTimeUTC)>now;
  const results=pregame?await Promise.allSettled([
   read('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard?dates='+date.replaceAll('-','')),
   read('https://api-web.nhle.com/v1/roster/'+game.homeTeam.abbrev+'/current'),
   read('https://api-web.nhle.com/v1/roster/'+game.awayTeam.abbrev+'/current'),
   read('https://api-web.nhle.com/v1/gamecenter/'+id+'/right-rail')
  ]):[];
  const get=i=>results[i]?.status==='fulfilled'?results[i].value:null,provider=matchProviderEvent(get(0),game),competitors=provider?.competitions?.[0]?.competitors||[];
  const rail=get(3),verifiedRail=(rail?.seasonSeries||[]).some(g=>String(g.id)===id&&g.homeTeam?.abbrev===game.homeTeam.abbrev&&g.awayTeam?.abbrev===game.awayTeam.abbrev)?rail:null;
  const side=s=>({team:game[s+'Team'].abbrev,goalie:goalieStatus(competitors.find(t=>t.homeAway===s),get(s==='home'?1:2)),lineup:normalizeScratches(verifiedRail,s)});
  const result=json({gameId:id,date:game.gameDate,startTime:game.startTimeUTC,gameState:game.gameState,pregame,checkedAt:new Date(now).toISOString(),providerEventId:provider?.id||null,home:side('home'),away:side('away'),sources:{goalies:'ESPN explicit probable-starter flags, matched to NHL goalie roster',scratches:'NHL game report'},notes:['Checked time is retrieval time; the provider does not supply a confirmation announcement timestamp','Empty scratch lists do not establish a confirmed lineup','No goalie-specific probability adjustment is applied']});
  if(cache)await cache.put(key,result.clone());return result;
 }catch{return json({message:'Pregame goalie and lineup context unavailable'},503)}
}
