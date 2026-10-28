import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {authenticate} from '../lib/access.js';
import {onRequest} from '../functions/_middleware.js';
import {makeClient} from '../scripts/paper-runner.mjs';
const now=Date.now(),token='a'.repeat(64),env={EDGEBOARD_COLLECTOR_TOKEN_SHA256:createHash('sha256').update(token).digest('hex'),EDGEBOARD_COLLECTOR_NOT_BEFORE:new Date(now-1000).toISOString(),EDGEBOARD_COLLECTOR_EXPIRES_AT:new Date(now+3600000).toISOString()};
const request=(path='/api/feed-status',options={})=>new Request('https://edgeboard-8fl.pages.dev'+path,{...options,headers:{'X-Edgeboard-Collector-Token':token,...options.headers}});
assert.equal((await authenticate(request(),env,now)).identity.kind,'collector');
for(const patch of [{},{EDGEBOARD_COLLECTOR_EXPIRES_AT:new Date(now).toISOString()},{EDGEBOARD_COLLECTOR_NOT_BEFORE:new Date(now+1000).toISOString()},{EDGEBOARD_COLLECTOR_EXPIRES_AT:new Date(now+32*86400000).toISOString()},{EDGEBOARD_COLLECTOR_TOKEN_SHA256:'0'.repeat(64)}]){const configured=Object.keys(patch).length?{...env,...patch}:{};assert.equal((await authenticate(request(),configured,now)).response.status,401)}
for(const path of ['/','/api/provider-balance','/api/paper-ledger','/api/unknown'])assert.equal((await authenticate(request(path),env,now)).response.status,401);
assert.equal((await authenticate(request('/api/feed-status',{method:'POST'}),env,now)).response.status,401);
assert.equal((await authenticate(request('/api/feed-status',{headers:{Origin:'https://edgeboard-8fl.pages.dev'}}),env,now)).response.status,401);
assert.equal((await authenticate(request('/api/feed-status',{headers:{'X-Edgeboard-Collector-Token':'b'.repeat(64)}}),env,now)).response.status,401);
let next=0;const response=await onRequest({request:request('/api/nhl-schedule'),env,data:{},next:async()=>{next++;return new Response('must stay paused')}});assert.equal(response.status,503);assert.equal(next,0);
assert.throws(()=>makeClient('https://other.test',{collectorToken:token}),/fixed production/);
let calls=0;const client=makeClient('https://edgeboard-8fl.pages.dev',{collectorToken:token,fetchImpl:async(url,options)=>{calls++;assert.equal(new URL(url).origin,'https://edgeboard-8fl.pages.dev');assert.equal(options.headers['X-Edgeboard-Collector-Token'],token);assert.equal(options.redirect,'manual');return Response.json({ok:true})}});
assert.equal((await client('/api/feed-status')).ok,true);await assert.rejects(client('//other.test/api/feed-status'));assert.equal(calls,1);
console.log('Scoped collector identity: hash, expiry, methods, paths, origin, held feeds and credential-isolated client passed');
