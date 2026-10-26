import {authenticate,ACCESS_IDENTITY,denied} from './access.js';
const bound=(n,fallback,max)=>Number.isInteger(Number(n))&&Number(n)>0?Math.min(Number(n),max):fallback;
export async function authorizeProvider(context,cost,now=Date.now()){
 let identity=context.data?.[ACCESS_IDENTITY];if(!identity||identity.expires<=now/1000){const auth=await authenticate(context.request,context.env,now);if(auth.response)return auth.response;identity=auth.identity}
 const env=context.env,db=env.SECURITY_DB;
 if(env.ALLOW_ODDS_FEED!=='true'||!db||!/^\d{4}-\d{2}-\d{2}$/.test(env.ODDS_BUDGET_PERIOD||''))return denied('Odds access is paused until private access and a shared quota budget are configured.');
 try{
  const url=new URL(context.request.url),event=url.searchParams.get('event');
  const accepted=new Set(url.pathname.endsWith('/nhl-props')?['event','market']:url.pathname.endsWith('/nhl-game-odds')?['event']:[]);
  if([...url.searchParams.keys()].some(k=>!accepted.has(k))||[...accepted].some(k=>url.searchParams.getAll(k).length>1))return denied('Unsupported request parameters.',400);
  if(url.pathname.endsWith('/nhl-props')&&!['player_shots_on_goal','player_goals','player_assists','player_points'].includes(url.searchParams.get('market')))return denied('Unsupported prop market.',400);
  if(url.pathname.endsWith('/nhl-props')||url.pathname.endsWith('/nhl-game-odds')){
   if(!/^[a-f0-9]{32}$/.test(event||''))return denied('Valid upcoming NHL event required.',400);
   const known=await db.prepare('SELECT starts_at FROM security_events WHERE event_id = ?').bind(event).first();if(!known||known.starts_at<=now||known.starts_at>now+7*86400000)return denied('Load the verified upcoming game list before requesting odds.',400);
  }
  const minute=Math.floor(now/60000),day=new Date(now).toISOString().slice(0,10),period=env.ODDS_BUDGET_PERIOD;
  const reserve=async(key,amount,limit)=>amount>limit?null:db.prepare('INSERT INTO security_usage (bucket, used) VALUES (?, ?) ON CONFLICT(bucket) DO UPDATE SET used = used + excluded.used WHERE used + excluded.used <= ? RETURNING used').bind(key,amount,limit).first();
  // The identity is verified before any shared limiter or provider call runs.
  const user=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(identity.email)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  if(!await reserve('rate:'+minute+':'+user,1,6))return denied('Request limit reached. Try again next minute.',429);
  if(cost>0){
   // Atomic decrement happens before any outbound request. Failed calls stay reserved.
   const budget=await db.prepare('UPDATE provider_state SET remaining_credits = remaining_credits - ? WHERE id = 1 AND remaining_credits - ? >= 100 RETURNING remaining_credits').bind(cost,cost).first();
   if(!budget)return denied('Provider reserve is unknown or below the safety floor.',429);
   if(!await reserve('period:'+period,cost,bound(env.ODDS_PERIOD_CREDIT_CAP,50,300)))return denied('Shared provider budget reached.',429);
   if(!await reserve('day:'+day,cost,bound(env.ODDS_DAY_CREDIT_CAP,12,48)))return denied('Daily provider budget reached.',429);
  }
  return null;
 }catch{return denied('Shared quota protection is unavailable. No provider request was made.')}
}
export async function recordProviderResponse(env,response){
 const remaining=response.headers.get('x-requests-remaining');
 if(remaining!=null&&Number.isFinite(Number(remaining)))await env.SECURITY_DB.prepare('UPDATE provider_state SET remaining_credits = MIN(remaining_credits, ?) WHERE id = 1').bind(Math.max(0,Math.floor(Number(remaining)))).run();
}
export async function rememberEvents(env,events){
 for(const e of events){const start=Date.parse(e.commence_time);if(!/^[a-f0-9]{32}$/.test(e.id||'')||!Number.isFinite(start)||start<=Date.now())continue;await env.SECURITY_DB.prepare('INSERT INTO security_events (event_id, starts_at) VALUES (?, ?) ON CONFLICT(event_id) DO UPDATE SET starts_at = excluded.starts_at').bind(e.id,start).run()}
}
