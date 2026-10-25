const json=(d,status=200,headers={})=>new Response(JSON.stringify(d),{status,headers:{'Content-Type':'application/json',...headers}});
const asset=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='assets.nhle.com'?u.href:null}catch{return null}};
export async function onRequestGet({request}){
 const url=new URL(request.url),id=url.searchParams.get('id');if(!/^\d{7}$/.test(id||''))return json({message:'Valid NHL player ID required'},400);
 const cache=caches.default,key=new Request(url.origin+'/api/nhl-player-profile?id='+id),cached=await cache.match(key);if(cached)return cached;
 try{const r=await fetch('https://api-web.nhle.com/v1/player/'+id+'/landing',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});if(!r.ok)return json({message:'Player photo unavailable'},503);
 const p=await r.json();if(String(p.playerId)!==id)return json({message:'Player identity unavailable'},502);
 const result=json({id,name:[p.firstName?.default,p.lastName?.default].filter(Boolean).join(' '),team:/^[A-Z]{3}$/.test(p.currentTeamAbbrev||'')?p.currentTeamAbbrev:null,number:p.sweaterNumber||null,position:p.position||null,headshot:asset(p.headshot),teamLogo:asset(p.teamLogo)},200,{'Cache-Control':'public, max-age=3600, s-maxage=86400'});await cache.put(key,result.clone());return result;
 }catch{return json({message:'Player photo unavailable'},503)}
}
