import assert from 'node:assert/strict';
import {requireCollectionReadiness} from '../scripts/collection-readiness.mjs';
const now=Date.now();let paths=[];
const status={schedule:{state:'enabled'},odds:{state:'configured'},accountingPeriod:'2026-10-27'};
const budget={checkedAt:new Date(now).toISOString(),oddsFeedEnabled:true,availableCredits:12,protectedRemainingCredits:431,accountingPeriod:'2026-10-27'};
const client=async path=>{paths.push(path);return path==='/api/feed-status'?status:budget};
assert.equal((await requireCollectionReadiness(client,now)).availableCredits,12);
status.schedule.state='paused';paths=[];await assert.rejects(requireCollectionReadiness(client,now));assert.deepEqual(paths,['/api/feed-status']);status.schedule.state='enabled';
for(const patch of [{availableCredits:0},{oddsFeedEnabled:false},{protectedRemainingCredits:100},{accountingPeriod:'wrong'},{checkedAt:new Date(now-61000).toISOString()}]){const bad=async path=>path==='/api/feed-status'?status:{...budget,...patch};await assert.rejects(requireCollectionReadiness(bad,now))}
await assert.rejects(requireCollectionReadiness(async()=>{throw Error('unavailable')},now));
console.log('Collector preflight stops paused, stale, exhausted and unavailable runs');
