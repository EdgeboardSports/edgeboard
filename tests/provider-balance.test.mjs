import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {onRequestPost} from '../functions/api/provider-balance.js';
import {ACCESS_IDENTITY} from '../lib/access.js';
import {budgetPeriod} from '../lib/budget-config.js';
const db=new DatabaseSync(':memory:');db.exec(readFileSync('docs/security-schema.sql','utf8'));
const env={THE_ODDS_API_KEY:'test-secret',SECURITY_DB:{prepare:sql=>({bind:(...args)=>({first:async()=>db.prepare(sql).get(...args)})})}};
const context=origin=>({env,data:{[ACCESS_IDENTITY]:{expires:Date.now()/1000+100}},request:new Request('https://edgeboard.test/api/provider-balance',{method:'POST',headers:{Origin:origin||'https://edgeboard.test'}})});
const old=globalThis.fetch;let calls=0,remaining='480',last='0';
globalThis.fetch=async(url,options)=>{calls++;assert.equal(new URL(url).pathname,'/v4/sports/');assert.equal(new URL(url).hostname,'api.the-odds-api.com');assert.equal(options.redirect,'manual');return new Response('{}',{headers:{'x-requests-remaining':remaining,'x-requests-last':last}})};
try{
 assert.equal((await onRequestPost(context('https://other.test'))).status,403);assert.equal(calls,0);
 let result=await (await onRequestPost(context())).json();assert.equal(result.protectedRemainingCredits,480);assert.equal(result.verificationCost,0);assert(!JSON.stringify(result).includes('test-secret'));
 assert.equal((await onRequestPost(context())).status,429);assert.equal(calls,1);
 db.exec("DELETE FROM security_usage;UPDATE provider_state SET remaining_credits=470");
 result=await (await onRequestPost(context())).json();assert.equal(result.protectedRemainingCredits,470);
 db.exec('DELETE FROM security_usage');remaining='450';result=await (await onRequestPost(context())).json();assert.equal(result.protectedRemainingCredits,450);
 db.exec('DELETE FROM security_usage');last='1';remaining='400';assert.equal((await onRequestPost(context())).status,502);assert.equal(db.prepare('SELECT remaining_credits FROM provider_state').get().remaining_credits,450);
 assert.equal(budgetPeriod({}),'2026-10-27');assert.equal(budgetPeriod({ODDS_BUDGET_PERIOD:'invalid'}),null);
 console.log('provider balance protections passed');
}finally{globalThis.fetch=old;db.close()}
