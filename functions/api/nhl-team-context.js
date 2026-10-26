const name=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const json=(d,status=200)=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json','Cache-Control':status===200?'public, max-age=300':'no-store'}});
async function read(url){const r=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Source unavailable');return r.json()}
export function normalizeAvailability(data,team,now){
 const age=now-Date.parse(data.timestamp);
 if(data.team?.abbreviation!==team||!Array.isArray(data.athletes)||!Number.isFinite(age)||age< -60000||age>3600000)return {available:false,players:[]};
 const players=data.athletes.flatMap(g=>Array.isArray(g.items)?g.items:[]).map(p=>({name:p.fullName||p.displayName,key:name(p.fullName||p.displayName),number:String(p.jersey||''),reports:(p.injuries||[]).filter(i=>typeof i.status==='string'&&Number.isFinite(Date.parse(i.date))&&Date.parse(i.date)<=now+60000).map(i=>({status:i.status,reportedAt:i.date}))}));
 return {available:players.length>0,source:'ESPN roster injury reports',sourceAt:data.timestamp,players};
}
export async function onRequestGet({request}){
 const p=new URL(request.url).searchParams,team=p.get('team'),date=p.get('date');
 if(!/^[A-Z]{3}$/.test(team||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)return json({message:'Valid team and date required'},400);
 const now=Date.now(),d=new Date(date+'T12:00:00Z'),year=d.getUTCFullYear()-(d.getUTCMonth()<6?1:0),season=String(year)+String(year+1);
 // Only present-day reports may be used as availability evidence.
 const today=new Date(now).toLocaleDateString('en-CA',{timeZone:'America/New_York'});
 try{
  const schedule=await read('https://api-web.nhle.com/v1/club-schedule-season/'+team+'/'+season);
  if(!Array.isArray(schedule.games))throw Error('Team schedule unavailable');
  const match=schedule.games.find(g=>g.homeTeam?.abbrev===team||g.awayTeam?.abbrev===team),teamId=match?.homeTeam?.abbrev===team?match.homeTeam.id:match?.awayTeam?.id;
  if(!Number.isInteger(teamId))throw Error('Team identity unavailable');
  const prior=schedule.games.filter(g=>g.gameType===2&&['OFF','FINAL'].includes(g.gameState)&&g.gameDate<date&&(g.homeTeam?.abbrev===team||g.awayTeam?.abbrev===team)).sort((a,b)=>b.gameDate.localeCompare(a.gameDate));
  const exp=encodeURIComponent('teamId='+teamId+' and gameTypeId=2 and seasonId='+season),sort=encodeURIComponent(JSON.stringify([{property:'gameDate',direction:'DESC'}]));
  const results=await Promise.allSettled([
   read('https://api.nhle.com/stats/rest/en/team/summary?isAggregate=false&isGame=true&start=0&limit=100&sort='+sort+'&cayenneExp='+exp),
   read('https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=false&isGame=true&start=0&limit=100&sort='+sort+'&cayenneExp='+exp),
   date===today?read('https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/teams/'+team.toLowerCase()+'/roster'):Promise.reject(Error('Availability is current-day only'))
  ]);
  const get=i=>results[i].status==='fulfilled'?results[i].value:null,summary=get(0),usage=get(1),injuries=get(2);
  // NHL caps this report at 100 rows even when a larger limit is requested.
  if(Array.isArray(usage?.data)&&Number(usage.total)>usage.data.length){
   const first=usage.data.length,total=Math.min(Number(usage.total),400);
   try{for(let start=first;start<total;start+=100){const page=await read('https://api.nhle.com/stats/rest/en/skater/timeonice?isAggregate=false&isGame=true&start='+start+'&limit=100&sort='+sort+'&cayenneExp='+exp);if(!Array.isArray(page.data)||!page.data.length)break;usage.data.push(...page.data)}}catch{usage.partial=true}
  }
  const validIds=new Set(prior.map(g=>String(g.id)));
  const shots=(summary?.data||[]).filter(g=>validIds.has(String(g.gameId))&&g.teamId===teamId&&g.gameDate<date&&g.shotsAgainstPerGame!=null&&g.shotsForPerGame!=null&&Number.isFinite(Number(g.shotsAgainstPerGame))&&Number.isFinite(Number(g.shotsForPerGame))).sort((a,b)=>b.gameDate.localeCompare(a.gameDate)).slice(0,20).map(g=>({gameId:g.gameId,date:g.gameDate,shotsAgainst:Number(g.shotsAgainstPerGame),shotsFor:Number(g.shotsForPerGame)}));
  const players={};for(const g of usage?.data||[]){if(g.teamAbbrev!==team||g.gameDate>=date||!validIds.has(String(g.gameId))||!/^\d{7}$/.test(String(g.playerId)))continue;const id=String(g.playerId);if(players[id]?.some(row=>String(row.gameId)===String(g.gameId)))continue;(players[id]??=[]).push({gameId:g.gameId,date:g.gameDate,toi:Number.isFinite(g.timeOnIce)?g.timeOnIce:null,ppToi:Number.isFinite(g.ppTimeOnIce)?g.ppTimeOnIce:null})}
  return json({team,date,checkedAt:new Date(now).toISOString(),lastGames:prior.slice(0,5).map(g=>({id:g.id,date:g.gameDate})),shots,usage:players,availability:injuries?normalizeAvailability(injuries,team,now):{available:false,players:[]},lineup:{status:'unknown',reason:'Confirmed lineup and starting goalie feed not connected'},sources:{team:'NHL official schedule and game statistics',injuries:'ESPN'},coverage:{shots:summary!==null,usage:usage!==null,availability:injuries!==null}});
 }catch{return json({message:'Team research context unavailable'},503)}
}
