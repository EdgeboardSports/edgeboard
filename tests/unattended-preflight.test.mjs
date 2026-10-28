import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unattendedPreflight} from '../scripts/unattended-preflight.mjs';
let posts=0,reads=0;
const transport=async(url,options)=>{
 if(url.startsWith('https://edgeboard-research-preview.speedystone18.chatgpt.site/')){
  posts++;assert(url.endsWith('/synthetic-evidence'));assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer test-only');
  return Response.json({persisted:true,readBack:true,duplicate:posts%2===0,digest:createHash('sha256').update(options.body).digest('hex')});
 }
 reads++;assert.equal(url,'https://edgeboard-8fl.pages.dev/api/feed-status');assert(!JSON.stringify(options).includes('test-only'));assert.equal(options.redirect,'manual');return new Response('{}',{status:401});
};
const result=await unattendedPreflight({token:'test-only',fetchImpl:transport});
assert.equal(result.storage.duplicateVerified,true);assert.equal(result.collectionReady,false);assert.equal(result.edgeboardApi.state,'service_access_not_configured');assert.equal(result.providerRequests,0);assert.equal(posts,2);assert.equal(reads,1);assert(!JSON.stringify(result).includes('test-only'));
let touched=false;await assert.rejects(unattendedPreflight({token:'test-only',fetchImpl:async()=>{touched=true;return new Response('{}',{status:401})}}));assert(touched);
console.log('Unattended preflight: authenticated synthetic writes, credential origin isolation, separate source access and paused collection verified');
posts=0;const serviceToken='d'.repeat(64);
const authenticated=await unattendedPreflight({token:'test-only',collectorToken:serviceToken,fetchImpl:async(url,options)=>{if(url.startsWith('https://edgeboard-research-preview.')){assert(!JSON.stringify(options).includes(serviceToken));return transport(url,options)}assert.equal(options.headers['X-Edgeboard-Collector-Token'],serviceToken);assert(!JSON.stringify(options).includes('test-only'));return Response.json({authentication:{method:'collector'},schedule:{state:'paused'},odds:{state:'blocked'}})}});
assert.equal(authenticated.edgeboardApi.authenticated,true);assert.equal(authenticated.edgeboardApi.feedsReady,false);assert.equal(authenticated.collectionReady,false);
