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
 const d=event.gameDay;
 if(!currentGameDay(d,event,now))return ['Starting goalies: unknown or stale','Game-day lineup: unconfirmed'];
 const lines=['home','away'].map(s=>{const t=d[s],g=t.goalie;return t.team+' goalie: '+(g?.name?g.name+' · ':'')+(g?.status||'unknown')+(g?.providerStatus?' (ESPN: '+g.providerStatus+')':'')});
 for(const side of ['home','away']){const t=d[side],scratch=t.lineup?.players||[];lines.push(t.team+' scratches: '+(scratch.length?scratch.map(p=>p.name||p.id).join(', '):'none published; lineup remains unconfirmed'))}
 return [...lines,'Goalie and scratch reports checked '+new Date(d.checkedAt).toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'})+' ET','Source: ESPN pregame goalie flags / NHL scratch report','Goalie confirmation is provider-reported; no goalie-specific probability adjustment'];
}
export async function refreshGameDay(rows,read){
 const groups=new Map();for(const r of rows){const key=String(r.event.nhlGameId||'');if(!/^\d{10}$/.test(key))continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r)}
 await Promise.all([...groups.values()].map(async group=>{const event=group[0].event;if(!(Date.parse(event.startTime||event.commenceTime)>Date.now()))return;const d=await loadGameDay(read,event);for(const r of group)r.event.gameDay=d}));
}
