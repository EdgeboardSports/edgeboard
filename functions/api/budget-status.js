import {authenticate,ACCESS_IDENTITY,securityHeaders,denied} from '../../lib/access.js';
import {budgetPeriod} from '../../lib/budget-config.js';
const cap=(value,fallback,max)=>Number.isInteger(Number(value))&&Number(value)>0?Math.min(Number(value),max):fallback;
// Read-only accounting. Never calls the provider or renews a budget.
export async function onRequestGet(context){
 const now=Date.now(),{env,request}=context;
 if(!context.data?.[ACCESS_IDENTITY]||context.data[ACCESS_IDENTITY].expires<=now/1000){const auth=await authenticate(request,env,now);if(auth.response)return auth.response}
 const period=budgetPeriod(env),day=new Date(now).toISOString().slice(0,10);
 if(!period||!env.SECURITY_DB)return denied('Shared budget unavailable.');
 try{
  const state=await env.SECURITY_DB.prepare('SELECT remaining_credits FROM provider_state WHERE id = 1').first();
  if(!Number.isSafeInteger(state?.remaining_credits)||state.remaining_credits<0)return denied('Verified balance unavailable.');
  const usage=async bucket=>{const row=await env.SECURITY_DB.prepare('SELECT used FROM security_usage WHERE bucket = ?').bind(bucket).first();if(!row)return 0;if(!Number.isSafeInteger(row.used)||row.used<0)throw Error('Invalid usage');return row.used};
  const periodUsed=await usage('period:'+period),dailyUsed=await usage('day:'+day),periodCap=cap(env.ODDS_PERIOD_CREDIT_CAP,50,300),dailyCap=cap(env.ODDS_DAY_CREDIT_CAP,12,48);
  return securityHeaders(new Response(JSON.stringify({checkedAt:new Date(now).toISOString(),accountingPeriod:period,day,protectedRemainingCredits:state.remaining_credits,reserveCredits:100,periodUsed,periodCap,dailyUsed,dailyCap,availableCredits:Math.max(0,Math.min(state.remaining_credits-100,periodCap-periodUsed,dailyCap-dailyUsed)),oddsFeedEnabled:env.ALLOW_ODDS_FEED==='true',note:'Accounting snapshot only. No provider request, budget reset, or feed change.'}),{headers:{'Content-Type':'application/json'}}));
 }catch{return denied('Shared budget unavailable.')}
}
