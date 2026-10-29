// Local research-only immutable chain; no provider fetch, public web route, or credentials.
// Records are canonical JSON envelopes; append is caller-controlled private storage.
import {createHash} from 'node:crypto';
import {evaluateHistoricalOdds} from './historical-odds-evaluator.mjs';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const canonical=x=>JSON.parse(JSON.stringify(x));
const types=new Set(['prediction','quote','settlement']);
export function appendResearchEvent(events,input,{recordedAt}={}){
 if(!Array.isArray(events)||!types.has(input?.type)||typeof recordedAt!=='string'||!Number.isFinite(Date.parse(recordedAt)))throw Error('Invalid append input');
 verifyResearchChain(events);
 const payload=canonical(input);
 if(!payload.data||typeof payload.data!=='object'||Array.isArray(payload.data))throw Error('Invalid event data');
 if(payload.type==='prediction'){
  const p=payload.data;
  if(!p.id||!p.predictedAt||Date.parse(p.predictedAt)>Date.parse(recordedAt))throw Error('Prediction must exist by recorded time');
 }else if(payload.type==='quote'){
  const q=payload.data;
  if(!q.observedAt||Date.parse(q.observedAt)>Date.parse(recordedAt))throw Error('Quote must exist by recorded time');
 }else{
  const s=payload.data;
  if(!s.predictionId||!['win','loss','push','void','pending'].includes(s.result))throw Error('Invalid settlement');
 }
 const previous=events.at(-1)?.hash??null;
 const entry={sequence:events.length+1,recordedAt,previous,type:payload.type,data:payload.data};
 return [...events,{...entry,hash:digest(entry)}];
}
export function verifyResearchChain(events){
 if(!Array.isArray(events))throw Error('Invalid chain');
 let previous=null;
 for(let i=0;i<events.length;i++){
  const e=events[i];
  if(e.sequence!==i+1||e.previous!==previous||!types.has(e.type)||!e.data||!Number.isFinite(Date.parse(e.recordedAt)))throw Error('Chain structure invalid');
  const {hash,...rest}=e;
  if(hash!==digest(rest))throw Error('Chain digest mismatch');
  previous=hash;
 }
 return {count:events.length,head:previous};
}
export function reportResearchLedger(events,{mode='synthetic',licenseReference,asOf}={}){
 const verification=verifyResearchChain(events);
 if(typeof asOf!=='string'||!Number.isFinite(Date.parse(asOf)))throw Error('Explicit as-of time required');
 const cutoff=Date.parse(asOf);
 const entries=events.filter(e=>Date.parse(e.recordedAt)<=cutoff);
 const predictions=new Map(),quotes=[],settlements=new Map(),rejected={duplicatePredictions:0,unknownSettlements:0};
 for(const e of entries){
  if(e.type==='prediction'){
   if(predictions.has(e.data.id)){rejected.duplicatePredictions++;continue}
   predictions.set(e.data.id,{...e.data,result:'pending'});
  }else if(e.type==='quote')quotes.push({...e.data,receivedAt:e.recordedAt});
  else if(!predictions.has(e.data.predictionId))rejected.unknownSettlements++;
  else {
   const prev=settlements.get(e.data.predictionId);
   if(!prev||Date.parse(e.recordedAt)>=Date.parse(prev.recordedAt))settlements.set(e.data.predictionId,{...e.data,recordedAt:e.recordedAt});
  }
 }
 const ready=[...predictions.values()].map(p=>({...p,result:settlements.get(p.id)?.result??'pending'}));
 const availableQuotes=quotes.filter(q=>ready.some(p=>p.eventId===q.eventId&&Date.parse(q.receivedAt)<=Date.parse(p.predictedAt)));
 const evaluated=evaluateHistoricalOdds({mode,licenseReference,predictions:ready,quotes:availableQuotes});
 return {...evaluated,ledger:{...verification,asOf,visibleEntries:entries.length,predictions:predictions.size,quotes:quotes.length,settlements:settlements.size,rejected},caveats:[...evaluated.caveats,
  'SHA-256 chain detects modifications relative to a trusted external head; it is not proof of timestamp authenticity or secure storage.',
  'Storage must be private, append-only, access-controlled and backed up before real licensed records are admitted.',
  'Settlements reflect latest recorded revision by report cutoff; corrections remain in the append-only history.']};
}
