const json=(d,status=200,headers={})=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json',...headers}});
export async function onRequestGet({env,request}){
 if(!env.THE_ODDS_API_KEY)return json({message:'Events feed is not configured.'},503);
 const cache=caches.default,key=new Request(new URL('/api/nhl-events',request.url));const saved=await cache.match(key);if(saved)return saved;
 try{const endpoint=new URL('https://api.the-odds-api.com/v4/sports/icehockey_nhl/events');endpoint.searchParams.set('apiKey',env.THE_ODDS_API_KEY);
 const r=await fetch(endpoint,{signal:AbortSignal.timeout(12000)});if(!r.ok)return json({message:'Events feed unavailable.'},502);
 const data=await r.json();if(!Array.isArray(data))return json({message:'Invalid events feed.'},502);
 const result=json({events:data.map(g=>({id:g.id,homeTeam:g.home_team,awayTeam:g.away_team,commenceTime:g.commence_time})),remainingCredits:r.headers.get('x-requests-remaining'),fetchedAt:new Date().toISOString()},200,{'Cache-Control':'public, max-age=60, s-maxage=1800'});
 await cache.put(key,result.clone());return result;
 }catch{return json({message:'Events feed connection failed.'},502)}
}