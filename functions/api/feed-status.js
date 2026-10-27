import {authenticate,ACCESS_IDENTITY,securityHeaders} from '../../lib/access.js';
// Read-only diagnostics. Never returns credentials or calls an external provider.
export async function onRequestGet(context){
 const {env,request}=context;
 if(!context.data?.[ACCESS_IDENTITY]){const auth=await authenticate(request,env);if(auth.response)return auth.response}
 const oddsBlockers=[];
 if(env.ALLOW_ODDS_FEED!=='true')oddsBlockers.push('Odds feed is paused.');
 if(!env.THE_ODDS_API_KEY)oddsBlockers.push('Odds API key is missing.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(env.ODDS_BUDGET_PERIOD||''))oddsBlockers.push('Odds budget period is not configured.');
 if(!env.SECURITY_DB)oddsBlockers.push('Shared quota database is not connected.');
 else try{const state=await env.SECURITY_DB.prepare('SELECT remaining_credits FROM provider_state WHERE id = 1').first();if(!state||!Number.isFinite(state.remaining_credits))oddsBlockers.push('Verified provider balance is not configured.');else if(state.remaining_credits<100)oddsBlockers.push('Provider balance is below the protected reserve.')}catch{oddsBlockers.push('Shared quota database is not initialized or unavailable.')}
 const scheduleReady=env.ALLOW_NHL_FEED==='true'&&env.ALLOW_ESPN_FEED==='true';
 return securityHeaders(new Response(JSON.stringify({checkedAt:new Date().toISOString(),schedule:{state:scheduleReady?'enabled':'paused',message:scheduleReady?'Schedule access enabled; response checked separately.':'Schedule and player data are paused pending provider review.'},odds:{state:oddsBlockers.length?'blocked':'configured',blockers:oddsBlockers},automation:{state:'paused',message:'Scheduled paper collection is paused. Saved forecasts remain available.'}}),{headers:{'Content-Type':'application/json'}}));
}
