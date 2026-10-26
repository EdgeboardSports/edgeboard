const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
export const CONTEXT_VERSION='context-v1';
const contextCaches=new WeakMap();
export async function teamContext(read,team,date){
 if(!/^[A-Z]{3}$/.test(team||''))return null;
 let cache=contextCaches.get(read);if(!cache){cache=new Map();contextCaches.set(read,cache)}const key=team+date,old=cache.get(key);if(old&&Date.now()-old.at<300000)return old.promise;
 const promise=(async()=>{try{const d=await read('/api/nhl-team-context?'+new URLSearchParams({team,date}));return d.team===team&&d.date===date?d:null}catch{return null}})();cache.set(key,{at:Date.now(),promise});return promise;
}
export function freshContext(d,now=Date.now()){const age=now-Date.parse(d?.checkedAt);return Number.isFinite(age)&&age>=-60000&&age<=10*60000}
export function roleTrend(rows,key){
 const recent=rows.slice(0,3).map(g=>g[key]).filter(x=>Number.isFinite(x)&&x>=0),prior=rows.slice(3,13).map(g=>g[key]).filter(x=>Number.isFinite(x)&&x>=0);
 if(recent.length<3||prior.length<5)return {available:false};
 const current=mean(recent),baseline=mean(prior),change=baseline>0?current/baseline-1:null;
 const material=key==='toi'?Math.abs(current-baseline)>=120&&Math.abs(change||0)>=.25:Math.abs(current-baseline)>=45&&(baseline===0||Math.abs(change||0)>=.4);
 return {available:true,recentSeconds:current,baselineSeconds:baseline,change,material,recentGames:recent.length,baselineGames:prior.length};
}
export function shotContext(d){const rows=d?.shots||[];return {games:rows.length,last10Against:mean(rows.slice(0,10).map(g=>g.shotsAgainst)),last10For:mean(rows.slice(0,10).map(g=>g.shotsFor)),baselineAgainst:mean(rows.slice(10,20).map(g=>g.shotsAgainst))}}
export function restContext(d,date){const last=d?.lastGames?.[0]?.date;if(!last||last>=date||!Number.isFinite(Date.parse(last))||!Number.isFinite(Date.parse(date)))return {available:false};const days=Math.round((Date.parse(date)-Date.parse(last))/86400000);return {available:true,lastGame:last,daysOff:days-1,backToBack:days===1}}
export function playerResearch(player,games,event,own,opponent,now=Date.now()){
 const warnings=[],blocks=[],availability={status:'unknown',reports:[]},fresh=freshContext(own,now);
 if(!fresh||!own?.availability?.available){warnings.push('Injury report unavailable or stale');blocks.push('Current injury report unverified')}
 else{
  const matches=own.availability.players.filter(p=>p.key===clean(player.name));
  if(matches.length!==1){warnings.push('No unique injury-feed player match');blocks.push('Current injury report unverified')}
  else{availability.reports=matches[0].reports;availability.status=availability.reports.length?'reported':'no_report';if(availability.reports.length){warnings.push(...availability.reports.map(r=>'Reported '+r.status+' · '+r.reportedAt));blocks.push('Reported injury/status requires review')}}
 }
 const rows=(own?.usage?.[String(player.id)]||[]).filter(g=>g.date<event.date).sort((a,b)=>b.date.localeCompare(a.date));
 const iceTime=fresh?roleTrend(rows,'toi'):{available:false},powerPlay=fresh?roleTrend(rows,'ppToi'):{available:false};
 for(const [label,trend]of [['Ice-time',iceTime],['Power-play usage',powerPlay]])if(trend.material){warnings.push(label+' changed materially versus prior games');blocks.push(label+' change requires review')}
 if(!iceTime.available)warnings.push('Insufficient recent ice-time history');
 if(!powerPlay.available)warnings.push('Insufficient power-play usage history');
 const played=new Set(games.filter(g=>(g.gameDate||g.date)<event.date).map(g=>String(g.gameId))),last=own?.lastGames?.slice(0,2)||[];
 const missed=fresh&&last.length===2&&last.every(g=>!played.has(String(g.id)));if(missed){warnings.push('No appearance in the last two team games; cause unknown');blocks.push('Recent absence requires review')}
 warnings.push('Tonight’s lineup is unconfirmed');
 return {version:CONTEXT_VERSION,checkedAt:own?.checkedAt||null,availability,iceTime,powerPlay,recentAbsence:missed,rest:restContext(own,event.date),opponentShots:freshContext(opponent,now)?shotContext(opponent):null,lineupConfirmed:false,warnings,blocks};
}
export function gameResearch(event,home,away,now=Date.now()){
 return {version:CONTEXT_VERSION,checkedAt:new Date(now).toISOString(),home:{team:event.homeAbbrev,rest:restContext(home,event.date),shots:freshContext(home,now)?shotContext(home):null},away:{team:event.awayAbbrev,rest:restContext(away,event.date),shots:freshContext(away,now)?shotContext(away):null},startingGoalies:'unconfirmed',warnings:['Starting goalies unconfirmed; no goalie-specific probability adjustment','Rest and shot matchup context are descriptive; model probabilities are unchanged']};
}
export function researchLines(r){
 if(!r)return ['Additional game-day research unavailable'];const lines=[];
 if(r.availability){lines.push(r.availability.status==='reported'?'Availability: reported injury/status — review required':r.availability.status==='no_report'?'No injury report found in the current feed; availability is not confirmed':'Availability unknown');
 for(const [label,t]of [['Ice time',r.iceTime],['Power-play time',r.powerPlay]])lines.push(t?.available?label+': last 3 '+(t.recentSeconds/60).toFixed(1)+' min / prior '+t.baselineGames+' '+(t.baselineSeconds/60).toFixed(1)+' min'+(t.material?' · material change':''):label+': insufficient history');
 if(r.rest?.available)lines.push('Rest: '+r.rest.daysOff+' full days off'+(r.rest.backToBack?' · back-to-back':''));
 if(r.opponentShots?.games)lines.push('Opponent allows '+r.opponentShots.last10Against.toFixed(1)+' shots/game · last '+Math.min(10,r.opponentShots.games));
 }else for(const side of ['home','away']){const t=r[side];if(t?.rest?.available)lines.push(t.team+': '+t.rest.daysOff+' days off'+(t.rest.backToBack?' · back-to-back':''));if(t?.shots?.games)lines.push(t.team+': allows '+t.shots.last10Against.toFixed(1)+' shots/game · last '+Math.min(10,t.shots.games))}
 if(r.checkedAt)lines.push('Research checked '+new Date(r.checkedAt).toISOString()+' · NHL statistics / ESPN injury reports');return [...lines,...r.warnings||[],'Matchup and role signals do not adjust the probability model yet'];
}
