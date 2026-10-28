import assert from 'node:assert/strict';
import {onRequestGet} from '../functions/api/budget-status.js';
import {ACCESS_IDENTITY} from '../lib/access.js';
const old=globalThis.fetch;globalThis.fetch=()=>{throw Error('Outbound forbidden')};
const env={SECURITY_DB:{prepare:sql=>sql.includes('provider_state')?{first:async()=>({remaining_credits:431})}:{bind:bucket=>({first:async()=>({used:bucket.startsWith('period:')?45:3})})}}};
const ctx={env,request:new Request('https://edgeboard.test/api/budget-status'),data:{[ACCESS_IDENTITY]:{expires:Date.now()/1000+100}}};
try{
 let response=await onRequestGet(ctx);assert.equal(response.headers.get('Cache-Control'),'private, no-store');let body=await response.json();assert.equal(body.availableCredits,5);assert.equal(body.oddsFeedEnabled,false);
 env.ODDS_PERIOD_CREDIT_CAP='-5';assert.equal((await (await onRequestGet(ctx)).json()).periodCap,50);
 env.SECURITY_DB.prepare=()=>({first:async()=>({remaining_credits:99}),bind:()=>({first:async()=>null})});assert.equal((await (await onRequestGet(ctx)).json()).availableCredits,0);
 env.SECURITY_DB.prepare=()=>{throw Error('offline')};assert.equal((await onRequestGet(ctx)).status,503);
 console.log('Read-only budget status protections passed');
}finally{globalThis.fetch=old}
