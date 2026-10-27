export const GAME_DAY_VERSION='game-day-v1';
export async function loadGameDay(read,event){
 if(!/^\d{10}$/.test(String(event.nhlGameId||'')))return null;
 try{const d=await read('/api/nhl-game-context?gameId='+event.nhlGameId);return String(d.gameId)===String(event.nhlGameId)&&d.home?.team===event.homeAbbrev&&d.away?.team===event.awayAbbrev?d:null}catch{return null}
}
export function currentGameDay(d,event,now=Date.now()){
 const age=now-Date.parse(d?.checkedAt);
 return !!d&&d.pregame===true&&['FUT','PRE'].includes(d.gameState)&&Number.isFinite(age)&&age>=-60000&&age<=3*60000&&Date.parse(d.startTime)>now&&Date.parse(event.startTime||event.commenceTime)>now&&(!event.date||d.date===event.date)&&Math.abs(Date.parse(d.startTime)-Date.parse(event.startTime||event.commenceTime))<=15*60000&&String(d.gameId)===String(event.nhlGameId)&&d.home?.team===event.homeAbbrev&&d.away?.team===event.awayAbbrev;
}
export function confirmedGoalies(event,now=Date.now()){
 return currentGameDay(event.gameDay,event,now)&&['home','away'].every(s=>event.gameDay[s].goalie?.status==='confirmed'&&/^\d{7}$/.test(event.gameDay[s].goalie.playerId||''));
}
export function playerLineup(event,playerId,now=Date.now()){
 if(!currentGameDay(event.gameDay,event,now))return {status:'unknown'};
 const scratched=['home','away'].flatMap(s=>event.gameDay[s]?.lineup?.players||[]).find(p=>String(p.id)===String(playerId));
 return scratched?{status:'scratched',name:scratched.name,source:'NHL game report'}:{status:'unknown'};
}
export function gameDayLines(event,now=Date.now()){
 const evidence=gameDayEvidence(event,now),lines=[];
 for(const side of ['home','away']){
  const g=evidence[side];lines.push(g.team+' goalie: '+(g.name?g.name+' · ':'')+g.status+(g.status==='stale'?' (last reported '+g.reportedStatus+')':''));
  lines.push(g.team+' source: '+g.source+' · retrieved '+(Number.isFinite(Date.parse(g.checkedAt))?new Date(g.checkedAt).toISOString():'unknown')+' · announcement time '+(g.sourceUpdatedAt||'not provided'));
  lines.push(g.team+' scratches: '+(g.scratches.length?g.scratches.map(p=>p.name||p.id).join(', '):'none verified; lineup remains unconfirmed'));
 }
 if(evidence.reason)lines.push('Blocks goalie confirmation: '+evidence.reason);
 return [...lines,'Goalie confirmation is provider-reported; no goalie-specific probability adjustment'];
}
export async function refreshGameDay(rows,read){
 const groups=new Map();for(const r of rows){const key=String(r.event.nhlGameId||'');if(!/^\d{10}$/.test(key))continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 await Promise.all([...groups.values()].map(async group=>{const event=group[0].event;if(!(Date.parse(event.startTime||event.commenceTime)>Date.now()))return;const d=await loadGameDay(read,event);for(const r of group)r.event.gameDay=d}));
}

// Retrieval freshness and provider-reported status are separate evidence.
export function gameDayEvidence(event,now=Date.now()){
 const d=event.gameDay,age=now-Date.parse(d?.checkedAt),current=currentGameDay(d,event,now);
 const stale=!!d&&Number.isFinite(age)&&age>3*60000;
 const reason=current?null:!d?'Report unavailable':stale?'Report older than three minutes':'Game identity, time or pregame state unverified';
 const sides=Object.fromEntries(['home','away'].map(side=>{
  const team=d?.[side],goalie=team?.goalie;
  const reported=['confirmed','projected'].includes(goalie?.status)?goalie.status:'unknown';
  const validId=/^\d{7}$/.test(goalie?.playerId||'');
  return [side,{team:event[side+'Abbrev']||team?.team||'Unknown team',name:goalie?.name||null,playerId:validId?goalie.playerId:null,status:current?(validId?reported:'unknown'):stale?'stale':'unknown',reportedStatus:reported,source:goalie?.source||'ESPN pregame probable starters',checkedAt:d?.checkedAt||null,sourceUpdatedAt:goalie?.sourceUpdatedAt||null,lineupStatus:current&&team?.lineup?.players?.length?'scratches reported':'unconfirmed',scratches:current?(team?.lineup?.players||[]):[]}];
 }));
 return {current,reason,checkedAt:d?.checkedAt||null,ageSeconds:Number.isFinite(age)?Math.max(0,Math.floor(age/1000)):null,...sides};
}
