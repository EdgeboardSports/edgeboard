import {createHash} from 'node:crypto';
import {normalizeTrialProtocol,normalizeTrialRun} from './trial-schema.mjs';
const trialDigest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const trialOrigin='https://edgeboard-research-preview.speedystone18.chatgpt.site';
export function openHostedTrialStore({token,synthetic=false,fetchImpl=fetch}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Private trial authentication required');
 const endpoint=trialOrigin+'/collector/api/trial?scope='+(synthetic?'synthetic':'live'),protocols=new Map(),claims=new Map();
 const send=async(path,body)=>{if(!token)throw Error('Trial store is closed');let response;try{response=await fetchImpl(endpoint+path,{method:body?'POST':'GET',headers:{Accept:'application/json','OAI-Sites-Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'manual',signal:AbortSignal.timeout(30000)})}catch{throw Error('Private trial transport unavailable')}if(!response.ok)throw Error('Private trial refused request (HTTP '+response.status+')');return response.json()};
 const acknowledge=(ack,id,value)=>{if(ack.id!==id||ack.digest!==trialDigest(value)||ack.persisted!==true||ack.readBack!==true||ack.synthetic!==synthetic)throw Error('Trial persistence not verified');return ack};
 const prefix='trial-'+(synthetic?'synthetic':'live');
 return {
  async status(){const r=await send('');if(r.synthetic!==synthetic||r.providerRequests!==0)throw Error('Unverified trial status');if(r.phase==='not_configured'){if(r.trialStarted!==false)throw Error('Invalid empty trial status');return r}return this.read(r.protocol?.id)},
  async create(protocol){const p=normalizeTrialProtocol(protocol),ack=acknowledge(await send('',{type:'protocol',protocol:p}),prefix+'-protocol:'+p.id,p);protocols.set(p.id,{protocol:p,digest:ack.digest});return ack},
  async activate(id,predictionId){const saved=protocols.get(id)||await this.read(id).then(r=>({protocol:r.protocol,digest:r.protocolDigest}));return acknowledge(await send('',{type:'activate',trialId:id,...(predictionId?{predictionId}:{})}),prefix+'-activation:'+id,{trialId:id,protocolDigest:saved.digest})},
  async read(id,{asOf,day}={}){if(!/^[a-z0-9][a-z0-9-]{7,63}$/.test(id||''))throw Error('Valid trial ID required');const r=await send('&id='+id+(asOf?'&asOf='+encodeURIComponent(asOf):'')+(day?'&day='+encodeURIComponent(day):''));const p=normalizeTrialProtocol(r.protocol);if(p.id!==id||r.synthetic!==synthetic||r.providerRequests!==0||r.protocolDigest!==trialDigest(p))throw Error('Trial report not verified');protocols.set(id,{protocol:p,digest:r.protocolDigest});return r},
  async claim(run){const saved=protocols.get(run.trialId);if(!saved)throw Error('Read frozen trial protocol before collecting');const normalized=normalizeTrialRun(run,saved.protocol);if(normalized.type!=='start')throw Error('Start required');const ack=await send('',{type:'run',trialId:run.trialId,run:normalized});if(ack.synthetic!==synthetic||typeof ack.claimed!=='boolean')throw Error('Invalid run claim');if(!ack.claimed)return {claimed:false};acknowledge(ack,prefix+'-run:'+run.trialId+':'+run.slotAt+':start',{protocolDigest:saved.digest,run:normalized});claims.set(run.trialId+run.slotAt,ack.digest);return ack},
  async complete(run){const saved=protocols.get(run.trialId),startDigest=claims.get(run.trialId+run.slotAt);if(!saved||!startDigest)throw Error('Verified durable claim required');const normalized=normalizeTrialRun(run,saved.protocol);if(normalized.type!=='finish')throw Error('Completion required');return acknowledge(await send('',{type:'run',trialId:run.trialId,run:normalized}),prefix+'-run:'+run.trialId+':'+run.slotAt+':finish',{protocolDigest:saved.digest,startDigest,run:normalized})},
  close(){token=null;claims.clear();protocols.clear()}
 };
}
export async function executeTrialSlot({store,trialId,sourceCommit,checkReady,collect,clock=()=>Date.now()}={}){
 const report=await store.read(trialId),p=report.protocol,now=clock(),start=Date.parse(p.startAt),slotAt=new Date(Math.floor(now/3600000)*3600000).toISOString();
 if(!report.trialStarted||now<start||now>=start+30*86400000||now-Date.parse(slotAt)>15*60000)throw Error('No timely active trial slot; no backfill');
 if(p.sourceCommit!==sourceCommit||JSON.stringify(p.modelVersions)!==JSON.stringify(['goals-v1','shots-v1'])||JSON.stringify(p.markets)!==JSON.stringify(['h2h','h2h_3_way','player_shots_on_goal','spreads']))throw Error('Collector does not match frozen trial protocol');
 const claim=await store.claim({trialId,slotAt,type:'start'});if(!claim.claimed)return {skipped:true,reason:'slot_already_claimed'};
 let outcome='held',counts={capturedGames:0,newPredictions:0,gradeChanges:0,errors:0},result;
 try{await checkReady({through:new Date(start+30*86400000).toISOString(),protocol:p})}catch{await store.complete({trialId,slotAt,type:'finish',outcome,counts});return {outcome,counts}}
 try{const collected=await collect();counts=collected.counts;result=collected.result;outcome=counts.errors?'error':'success'}catch{outcome='error';counts={capturedGames:0,newPredictions:0,gradeChanges:0,errors:1}}
 await store.complete({trialId,slotAt,type:'finish',outcome,counts});return {outcome,counts,result};
}
