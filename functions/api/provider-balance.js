import {authenticate,ACCESS_IDENTITY,denied,securityHeaders} from '../../lib/access.js';
import {budgetPeriod} from '../../lib/budget-config.js';
const json=data=>securityHeaders(new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}}));
export async function onRequestPost(context){
 const {env,request}=context,now=Date.now();
 if(!context.data?.[ACCESS_IDENTITY]||context.data[ACCESS_IDENTITY].expires<=now/1000){const auth=await authenticate(request,env,now);if(auth.response)return auth.response}
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin||url.search)return denied('Same-origin verification required.',403);
 if(!env.THE_ODDS_API_KEY||!env.SECURITY_DB)return denied('Provider key and shared quota database required.');
 if(!budgetPeriod(env))return denied('Valid fixed accounting period required.');
 try{
  // Single shared verification each minute. Failures retain this reservation.
  const reserved=await env.SECURITY_DB.prepare('INSERT INTO security_usage(bucket,used) VALUES(?,?) ON CONFLICT(bucket) DO UPDATE SET used=excluded.used WHERE security_usage.used <= ? RETURNING used').bind('provider-balance-check',now,now-60000).first();
  if(!reserved)return denied('Balance was checked recently. Wait one minute.',429);
  // Only the documented quota-free catalog endpoint is allowed. No odds or scores are fetched.
  const endpoint=new URL('https://api.the-odds-api.com/v4/sports/');endpoint.searchParams.set('apiKey',env.THE_ODDS_API_KEY);
  const response=await fetch(endpoint.toString(),{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(!response.ok)return denied('Provider verification failed. No balance was saved.',502);
  const remaining=response.headers.get('x-requests-remaining'),last=response.headers.get('x-requests-last');
  if(!/^\d+$/.test(remaining||'')||!Number.isSafeInteger(Number(remaining))||last!=='0')return denied('Provider did not return a valid balance and zero-cost confirmation. No balance was saved.',502);
  // Initial state comes from the provider. Later checks cannot raise a conservatively reserved balance.
  const saved=await env.SECURITY_DB.prepare('INSERT INTO provider_state(id,remaining_credits) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET remaining_credits=MIN(provider_state.remaining_credits,excluded.remaining_credits) RETURNING remaining_credits').bind(Number(remaining)).first();
  if(!Number.isSafeInteger(saved?.remaining_credits))return denied('Verified balance could not be persisted.');
  return json({verified:true,observedRemainingCredits:Number(remaining),protectedRemainingCredits:saved.remaining_credits,verificationCost:0,accountingPeriod:budgetPeriod(env),reserveCredits:100,periodCreditCap:Math.min(Number(env.ODDS_PERIOD_CREDIT_CAP)||50,300),dailyCreditCap:Math.min(Number(env.ODDS_DAY_CREDIT_CAP)||12,48),feedSettingsChanged:false,note:'No feed setting was changed. The fixed accounting period is not a provider billing-date claim.'});
 }catch{return denied('Balance verification unavailable. No assumed balance was saved.',502)}
}
