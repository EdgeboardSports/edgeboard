// Append-only, content-addressed historical odds evidence. Research-only.
// This in-memory reference implementation requires external private durable storage
// before any real collection; it never fetches odds or writes to public assets.
import {createHash} from 'node:crypto';
import {evaluateHistoricalOdds} from './historical-odds-evaluator.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const validTime=s=>typeof s==='string'&&Number.isFinite(Date.parse(s));
const fields=['eventId','market','side'];
function identity(x){return [x.eventId,x.market,x.subjectId??null,x.line??null,x.side]}
function normalize(e){
 if(!e||typeof e!=='object'||Array.isArray(e)||!['prediction','quote','settlement'].includes(e.type))throw Error('Invalid evidence type');
 if(!e.data||typeof e.data!=='object'||Array.isArray(e.data))throw Error('Invalid evidence data');
 const x=structuredClone(e.data);
 for(const k of fields)if(typeof x[k]!=='string'||!x[k].trim())throw Error('Missing evidence identity');
 if(x.subjectId!=null&&(typeof x.subjectId!=='string'||!x.subjectId.trim()))throw Error('Invalid subject');
 if(x.line!=null&&(typeof x.line!=='number'||!Number.isFinite(x.line)))throw Error('Invalid line');
 if(e.type==='prediction'){
  if(typeof x.id!=='string'||!x.id.trim()||!validTime(x.predictedAt)||!validTime(x.startTime)||Date.parse(x.predictedAt)>=Date.parse(x.startTime))throw Error('Invalid pregame prediction');
  if(typeof x.probability!=='number'||x.probability<0||x.probability>1||!Number.isFinite(x.probability))throw Error('Invalid prediction probability');
 }else if(e.type==='quote'){
  if(typeof x.bookmaker!=='string'||!x.bookmaker.trim()||!validTime(x.observedAt)||typeof x.source!=='string'||!x.source.trim()||typeof x.decimal!=='number'||!Number.isFinite(x.decimal)||x.decimal<=1)throw Error('Invalid quote');
 }else if(typeof x.predictionId!=='string'||!x.predictionId.trim()||!validTime(x.gradedAt)||!['win','loss','push','void','pending'].includes(x.result))throw Error('Invalid settlement');
 return {type:e.type,data:x};
}
export function createHistoricalEvidenceLedger({mode='synthetic',licenseReference}={}){
 if(!['synthetic','licensed-historical'].includes(mode))throw Error('Invalid provenance mode');
 if(mode==='licensed-historical'&&(!licenseReference||typeof licenseReference!=='string'))throw Error('Licensed mode requires source authorization');
 const entries=[],byId=new Map();
 const expectedSource=mode==='synthetic'?'synthetic-fixture':licenseReference;
 const append=(event)=>{
  const normalized=normalize(event),{type,data}=normalized;
  if(type==='quote'&&data.source!==expectedSource)throw Error('Unapproved quote source');
  if(type==='prediction'&&entries.some(e=>e.type==='prediction'&&e.data.id===data.id))throw Error('Duplicate prediction ID');
  if(type==='settlement'){
   const original=entries.find(e=>e.type==='prediction'&&e.data.id===data.predictionId);
   if(!original||JSON.stringify(identity(original.data))!==JSON.stringify(identity(data)))throw Error('Settlement identity mismatch');
   if(Date.parse(data.gradedAt)<Date.parse(original.data.startTime))throw Error('Settlement predates event');
   const previous=entries.filter(e=>e.type==='settlement'&&e.data.predictionId===data.predictionId).at(-1);
   if(previous&&Date.parse(data.gradedAt)<=Date.parse(previous.data.gradedAt))throw Error('Settlement corrections must be later');
  }
  // Hash chain commits to canonical normalized evidence, append order and provenance.
  const previousDigest=entries.at(-1)?.digest??null;
  const body=JSON.stringify({schemaVersion:1,mode,licenseReference:mode==='licensed-historical'?licenseReference:null,previousDigest,...normalized});
  const digest=hash(body),record={...normalized,previousDigest,digest};
  entries.push(record);byId.set(digest,record);
  return digest;
 };
 const read=()=>structuredClone(entries);
 const verify=(records=entries)=>{
  let previousDigest=null;
  for(const entry of records){
   const normalized=normalize(entry),body=JSON.stringify({schemaVersion:1,mode,licenseReference:mode==='licensed-historical'?licenseReference:null,previousDigest,...normalized});
   if(entry.previousDigest!==previousDigest||entry.digest!==hash(body))throw Error('Evidence hash chain integrity failure');
   previousDigest=entry.digest;
  }
  return {entries:records.length,head:previousDigest,verified:true};
 };
 const evaluate=({asOf}={})=>{
  if(asOf!==undefined&&!validTime(asOf))throw Error('Invalid report cutoff');
  verify();
  const cutoff=asOf?Date.parse(asOf):Infinity;
  const predictions=entries.filter(e=>e.type==='prediction'&&Date.parse(e.data.predictedAt)<=cutoff).map(e=>e.data);
  const quotes=entries.filter(e=>e.type==='quote'&&Date.parse(e.data.observedAt)<=cutoff).map(e=>e.data);
  const settlements=entries.filter(e=>e.type==='settlement'&&Date.parse(e.data.gradedAt)<=cutoff);
  const latest=new Map();for(const e of settlements)latest.set(e.data.predictionId,e.data);
  return {...evaluateHistoricalOdds({mode,licenseReference,predictions:predictions.map(p=>({...p,result:latest.get(p.id)?.result??'pending'})),quotes}),
   evidence:{...verify(),asOf:asOf??null,settlementVersions:settlements.length,predictions:predictions.length,quotes:quotes.length},
   storage:'in-memory synthetic reference; durable private backend not configured'};
 };
 return {append,read,verify,evaluate,mode};
}
