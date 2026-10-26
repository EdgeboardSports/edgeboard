import {authorizeProvider,recordProviderResponse,rememberEvents} from '../../lib/provider-security.js';
const markets = new Set(['player_shots_on_goal','player_goals','player_assists','player_points']);
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {status,headers:{'Content-Type':'application/json; charset=utf-8',...headers}});
export async function onRequestGet(context) {
 const {env,request}=context;const blocked=await authorizeProvider(context,1);if(blocked)return blocked;
 const url=new URL(request.url),event=url.searchParams.get('event'),market=url.searchParams.get('market');
 if(!/^[a-f0-9]{32}$/.test(event||'')||!markets.has(market))return json({message:'Choose a valid NHL game and prop market.'},400);
 if(!env.THE_ODDS_API_KEY)return json({message:'Live props are not configured.'},503);
 const cacheKey=new Request(url.origin+'/api/nhl-props-v16?event='+event+'&market='+market);
 const cache=caches.default,cached=await cache.match(cacheKey);if(cached)return cached;
 const endpoint=new URL('https://api.the-odds-api.com/v4/sports/icehockey_nhl/events/'+event+'/odds');
 endpoint.searchParams.set('apiKey',env.THE_ODDS_API_KEY);endpoint.searchParams.set('regions','us');endpoint.searchParams.set('markets',market);endpoint.searchParams.set('oddsFormat','american');
 try{
  const response=await fetch(endpoint,{signal:AbortSignal.timeout(12000)});
  await recordProviderResponse(env,response);
  if(!response.ok)return json({message:response.status===429?'Provider credits or request limit reached. Try later.':response.status===404?'This event is no longer available. Choose another game.':'Player props are unavailable from the provider.'},response.status===429?429:502);
  const game=await response.json(),odds=[];
  for(const book of game.bookmakers||[])for(const m of book.markets||[])if(m.key===market)for(const o of m.outcomes||[]){
   const price=Number(o.price),point=Number(o.point);
   if(!o.description||!['Over','Under'].includes(o.name)||o.point==null||!Number.isFinite(point)||!Number.isFinite(price)||Math.abs(price)<100)continue;
   odds.push({player:o.description,side:o.name,point,american:price,decimal:price>0?1+price/100:1+100/Math.abs(price),bookmaker:book.key,bookmakerTitle:book.title||book.key,lastUpdate:m.last_update||null});
  }
  const result=json({status:'live',eventId:event,market,homeTeam:game.home_team,awayTeam:game.away_team,commenceTime:game.commence_time,fetchedAt:new Date().toISOString(),remainingCredits:response.headers.get('x-requests-remaining'),odds},200,{'Cache-Control':'public, max-age=60, s-maxage=600'});
  await cache.put(cacheKey,result.clone());return result;
 }catch{return json({message:'Player props connection failed. Please try later.'},502);}
}

