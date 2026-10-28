import assert from 'node:assert/strict';
import {makeClient} from '../scripts/paper-runner.mjs';
for(const status of [401,403,503]){
 const calls=[];const client=makeClient('https://edgeboard.test',{pause:async()=>{},fetchImpl:async(url,options)=>{calls.push(url);assert.equal(options.redirect,'manual');return new Response('{}',{status})}});
 await assert.rejects(client('/api/nhl-schedule?date=2026-10-27'));
 assert.equal(calls.length,3);assert(calls.every(url=>new URL(url).origin==='https://edgeboard.test'));
}
let requests=0;const client=makeClient('https://edgeboard.test',{pause:async()=>{},fetchImpl:async()=>{requests++;return new Response('{}',{status:503})}});
await assert.rejects(client('/api/nhl-props?event=test'));assert.equal(requests,1);
console.log('Collector cannot fall back around app holds; quota-bearing requests are not retried');
