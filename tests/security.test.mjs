import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFile} from 'node:fs/promises';
import {authenticate,ACCESS_IDENTITY} from '../lib/access.js';
import {authorizeProvider,rememberEvents} from '../lib/provider-security.js';
import {onRequest} from '../functions/_middleware.js';
import {onRequestGet as props} from '../functions/api/nhl-props.js';
import {onRequestGet as odds} from '../functions/api/nhl-odds.js';
import {onRequestGet as games} from '../functions/api/nhl-game-odds.js';
import {onRequestGet as events} from '../functions/api/nhl-events.js';
const now=Date.now(),email='owner@example.test',domain='https://edgeboard-test.cloudflareaccess.com',aud='test-audience',id='a'.repeat(32);
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-key';
const encode=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
async function token(change={},header={}){const h=encode({alg:'RS256',kid:jwk.kid,...header}),p=encode({type:'app',iss:domain,aud:[aud],email,iat:Math.floor(now/1000)-1,exp:Math.floor(now/1000)+3600,...change}),signed=h+'.'+p;return signed+'.'+Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(signed))).toString('base64url')}
const env={ACCESS_TEAM_DOMAIN:domain,ACCESS_AUD:aud,ACCESS_ALLOWED_EMAILS:email};
const request=(path='/')=>new Request('https://app'+path,{headers:{'Cf-Access-Jwt-Assertion':valid}});let valid=await token(),fetches=0;
const oldFetch=globalThis.fetch;
globalThis.fetch=async url=>{fetches++;assert.equal(String(url),domain+'/cdn-cgi/access/certs');return new Response(JSON.stringify({keys:[jwk]}))};
try{
 assert.equal((await authenticate(request(),{},now)).response.status,503);
 assert.equal((await authenticate(new Request('https://app'),env,now)).response.status,401);
 assert.equal((await authenticate(request(),env,now)).identity.email,email);
 for(const change of [{email:'intruder@example.test'},{aud:['wrong']},{iss:'https://attacker.invalid'},{exp:now/1000-1},{iat:now/1000+3600},{type:'org'}]){const jwt=await token(change);assert.equal((await authenticate(new Request('https://app',{headers:{'Cf-Access-Jwt-Assertion':jwt}}),env,now)).response.status,401)}
 const forged=valid.slice(0,-5)+'AAAAA';assert.equal((await authenticate(new Request('https://app',{headers:{'Cf-Access-Jwt-Assertion':forged}}),env,now)).response.status,401);
 const wrongAlg=await token({},{alg:'none'});assert.equal((await authenticate(new Request('https://app',{headers:{'Cf-Access-Jwt-Assertion':wrongAlg}}),env,now)).response.status,401);
 let downstream=0;const next=async()=>{downstream++;return new Response('private')};
 for(const path of ['/','/best-picks','/api/nhl-props','/data/paper-ledger.json','/netlify/functions/nhl-odds.js','/functions/api/nhl-props.js','/tests/game-day.test.mjs','/docs/security-schema.sql']){
  const response=await onRequest({request:new Request('https://app'+path),env:{},data:{},next});assert([401,403,404,503].includes(response.status));assert(response.headers.get('Content-Security-Policy').includes("frame-ancestors 'self'"));
 }
 assert.equal(downstream,0);
 const ok=await onRequest({request:request('/best-picks'),env,data:{},next});assert.equal(ok.status,200);assert.equal(ok.headers.get('Cache-Control'),'private, no-store');
 assert.equal((await onRequest({request:request('/api/nhl-schedule'),env,data:{},next})).status,503);
 for(const path of ['/api/nhl-schedule','/api/nhl-game-log','/api/nhl-roster','/api/nhl-player-profile']){
  assert.equal((await onRequest({request:request(path),env:{...env,ALLOW_NHL_FEED:'true'},data:{},next})).status,200);
  assert.equal((await onRequest({request:request(path),env:{...env,ALLOW_ESPN_FEED:'true'},data:{},next})).status,503);
 }
 for(const path of ['/api/nhl-team-context','/api/nhl-game-context','/api/nhl-unknown'])assert.equal((await onRequest({request:request(path),env:{...env,ALLOW_NHL_FEED:'true'},data:{},next})).status,503);
 const before=fetches;for(const handler of [props,odds,games,events]){const response=await handler({request:new Request('https://app/api/nhl-props?event='+id+'&market=player_shots_on_goal'),env:{THE_ODDS_API_KEY:'never-transmitted'}});assert.equal(response.status,503)}assert.equal(fetches,before);
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(await readFile(new URL('../docs/security-schema.sql',import.meta.url),'utf8'));
 const db={prepare:sql=>({bind:(...args)=>({first:async()=>sqlite.prepare(sql).get(...args)||null,run:async()=>sqlite.prepare(sql).run(...args)})})};
 const protectedEnv={...env,SECURITY_DB:db,ALLOW_ODDS_FEED:'true',ODDS_BUDGET_PERIOD:'2026-10-26',ODDS_PERIOD_CREDIT_CAP:'3',ODDS_DAY_CREDIT_CAP:'12'};
 sqlite.prepare('INSERT INTO provider_state VALUES(1, 110)').run();await rememberEvents(protectedEnv,[{id,commence_time:new Date(now+3600000).toISOString()}]);
 const ctx=()=>({request:request('/api/nhl-game-odds?event='+id),env:protectedEnv,data:{[ACCESS_IDENTITY]:{email,expires:now/1000+3600}}});
 assert.equal(await authorizeProvider(ctx(),3,now),null);
 assert.equal((await authorizeProvider(ctx(),3,now)).status,429);
 assert.equal((await authorizeProvider({...ctx(),env:{...protectedEnv,SECURITY_DB:null}},3,now)).status,503);
 assert.equal((await authorizeProvider({...ctx(),request:request('/api/nhl-game-odds?event='+'b'.repeat(32))},3,now)).status,400);
 assert.equal((await authorizeProvider({...ctx(),request:request('/api/nhl-game-odds?event='+id+'&event='+id)},3,now)).status,400);
 const many=await Promise.all(Array.from({length:12},()=>authorizeProvider({...ctx(),request:request('/api/nhl-events')},0,now)));assert(many.filter(r=>r===null).length<=4);assert(many.some(r=>r?.status===429));
 assert(sqlite.prepare('SELECT remaining_credits FROM provider_state').get().remaining_credits>=100);
 sqlite.close();
 console.log('Passed signed JWT/issuer/audience/owner checks, all-route fail-closed behavior, raw-file denial, permission holds, zero unauthenticated provider calls, atomic shared budgets, event allowlisting and request limits.');
}finally{globalThis.fetch=oldFetch}
