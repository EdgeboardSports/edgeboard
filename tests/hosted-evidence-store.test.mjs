import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openHostedEvidenceStore} from '../scripts/hosted-evidence-store.mjs';
const input={event:{id:'a'.repeat(32),nhlGameId:'2026020100',homeAbbrev:'TOR',awayAbbrev:'CAR',startTime:'2099-01-01T01:00:00Z'},capturedAt:'2099-01-01T00:00:00Z',secret:'do-not-send'};
assert.throws(()=>openHostedEvidenceStore(),/authentication/);
let calls=0;
const store=openHostedEvidenceStore({token:'test-only',fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://edgeboard-research-preview.speedystone18.chatgpt.site/collector/api/evidence');assert.equal(options.redirect,'manual');assert(!options.body.includes('do-not-send'));return Response.json({persisted:true,readBack:true,duplicate:calls>1,digest:createHash('sha256').update(options.body).digest('hex')})}});
assert.equal((await store.append(input)).inserted,true);assert.equal((await store.append(input)).inserted,false);
for(const response of [new Response('{}',{status:503}),Response.json({persisted:true,readBack:true,digest:'wrong'})]){const denied=openHostedEvidenceStore({token:'test',fetchImpl:async()=>response});await assert.rejects(denied.append(input))}
const offline=openHostedEvidenceStore({token:'test',fetchImpl:async()=>{throw Error('sensitive transport detail')}});await assert.rejects(offline.append(input),e=>!e.message.includes('sensitive'));
console.log('Hosted transport: allowlist, redaction, no redirects, readback digest, duplicate and failure checks passed');
let syntheticCalls=0;const synthetic=openHostedEvidenceStore({token:'test',synthetic:true,fetchImpl:async(url,options)=>{syntheticCalls++;assert(url.endsWith('/collector/api/synthetic-evidence'));assert.equal(JSON.parse(options.body).synthetic,true);return Response.json({persisted:true,readBack:true,digest:createHash('sha256').update(options.body).digest('hex')})}});
assert.equal((await synthetic.append(input)).inserted,true);synthetic.close();await assert.rejects(synthetic.append(input),/closed/);assert.equal(syntheticCalls,1);
