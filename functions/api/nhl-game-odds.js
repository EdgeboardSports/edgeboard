const json=(d,status=200,headers={})=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json',...headers}});
export async function onRequestGet({env,request}){
 const url=new URL(request.url),event=url.searchParams.get('event');if(!/^[a-f0-9]{32}$/.test(event||''))return json({message:'Valid game event required'},400);
 if(!env.THE_ODDS_API_KEY)return json({message:'Game odds are not configured'},503);
 const key=new Request(url.origin+'/api/nhl-game-odds-v18?event='+event),cache=caches.default,cached=await cache.match(key);if(cached)return cached;
 const endpoint=new URL('https://api.the-odds-api.com/v4/sports/icehockey_nhl/events/'+event+'/odds');
 for(const [k,v]of Object.entries({apiKey:env.THE_ODDS_API_KEY,regions:'us',markets:'h2h,spreads,h2h_3_way',oddsFormat:'american'}))endpoint.searchParams.set(k,v);
 try{
  const r=await fetch(endpoint,{signal:AbortSignal.timeout(12000)});if(!r.ok)return json({message:r.status===429?'Provider credit or rate limit reached':'Game-market feed unavailable'},r.status===429?429:502);
  const game=await r.json(),odds=[];
  for(const book of game.bookmakers||[])for(const m of book.markets||[])if(['h2h','spreads','h2h_3_way'].includes(m.key))for(const o of m.outcomes||[]){
   const n=Number(o.price),side=o.name===game.home_team?'Home':o.name===game.away_team?'Away':/^(draw|tie)$/i.test(o.name||'')?'Draw':null;
   if(!side||side==='Draw'&&m.key!=='h2h_3_way'||!Number.isFinite(n)||Math.abs(n)<100||m.key==='spreads'&&(o.point==null||!Number.isFinite(Number(o.point))))continue;
   odds.push({market:m.key,side,selection:o.name,point:m.key==='spreads'?Number(o.point):null,american:n,decimal:n>0?1+n/100:1+100/Math.abs(n),bookmaker:book.key,bookmakerTitle:book.title||book.key,lastUpdate:m.last_update||null});
  }
  const result=json({status:'live',eventId:event,homeTeam:game.home_team,awayTeam:game.away_team,commenceTime:game.commence_time,fetchedAt:new Date().toISOString(),remainingCredits:r.headers.get('x-requests-remaining'),markets:['h2h','spreads','h2h_3_way'],odds},200,{'Cache-Control':'public, max-age=60, s-maxage=600'});
  await cache.put(key,result.clone());return result;
 }catch{return json({message:'Game-market connection failed'},502)}
}