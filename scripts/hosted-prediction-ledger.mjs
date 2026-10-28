import {createHash} from 'node:crypto';
import {normalizeLedgerPrediction,normalizeLedgerGrade} from './prediction-ledger-schema.mjs';
const ledgerDigest=value=>createHash('sha256').update(value).digest('hex');
const ORIGIN='https://edgeboard-research-preview.speedystone18.chatgpt.site';
export function openHostedPredictionLedger({token,synthetic=false,fetchImpl=fetch}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Private ledger authentication required');
 const endpoint=ORIGIN+'/collector/api/prediction-ledger?scope='+(synthetic?'synthetic':'live');
 const send=async(url,payload)=>{if(!token)throw Error('Private ledger is closed');let response;try{response=await fetchImpl(url,{method:payload?'POST':'GET',headers:{Accept:'application/json','OAI-Sites-Authorization':'Bearer '+token,...(payload?{'Content-Type':'application/json'}:{})},...(payload?{body:payload}:{}),redirect:'manual',signal:AbortSignal.timeout(20000)})}catch{throw Error('Private ledger transport unavailable')}if(!response.ok)throw Error('Private ledger refused request (HTTP '+response.status+')');try{return await response.json()}catch{throw Error('Invalid ledger response')}};
 const post=async envelope=>{const payload=JSON.stringify(envelope),result=await send(endpoint,payload),expectedId=envelope.type==='prediction'?ledgerDigest(envelope.snapshot.id):ledgerDigest(JSON.stringify([envelope.grade.predictionId,envelope.grade.previousGradeDigest]));if(result.id!==expectedId||result.persisted!==true||result.readBack!==true||result.synthetic!==synthetic||result.digest!==ledgerDigest(payload)||!/^[a-f0-9]{64}$/.test(result.id||''))throw Error('Ledger persistence was not verified');return result};
 const verify=record=>{
  if(record.synthetic!==synthetic||JSON.stringify(normalizeLedgerPrediction(record.snapshot))!==JSON.stringify(record.snapshot)||record.id!==ledgerDigest(record.snapshot.id)||record.digest!==ledgerDigest(JSON.stringify({schemaVersion:1,type:'prediction',synthetic,snapshot:record.snapshot})))throw Error('Frozen prediction integrity failure');
  let previous=null;for(const entry of record.grades){const {digest,...grade}=entry;delete grade.receivedAt;if(JSON.stringify(normalizeLedgerGrade(grade,record.snapshot))!==JSON.stringify(grade)||grade.predictionId!==record.id||grade.previousGradeDigest!==previous||digest!==ledgerDigest(JSON.stringify({schemaVersion:1,type:'grade',synthetic,grade})))throw Error('Grade chain integrity failure');previous=digest}
  if(record.head!==previous)throw Error('Grade head mismatch');
  const values=record.grades.map(g=>({...g.result,gradedAt:g.gradedAt}));if(JSON.stringify(record.result)!==JSON.stringify(values.at(-1)||{state:'pending'})||JSON.stringify(record.resultHistory)!==JSON.stringify(values.slice(0,-1)))throw Error('Grade materialization mismatch');return record;
 };
 return {
  appendPrediction(snapshot){return post({schemaVersion:1,type:'prediction',synthetic,snapshot:normalizeLedgerPrediction(snapshot)})},
  appendGrade(input,snapshot){return post({schemaVersion:1,type:'grade',synthetic,grade:normalizeLedgerGrade(input,snapshot)})},
  async read(id,{asOf}={}){if(!/^[a-f0-9]{64}$/.test(id||''))throw Error('Valid prediction ID required');return verify(await send(endpoint+'&id='+id+(asOf?'&asOf='+encodeURIComponent(asOf):'')))},
  async restore(){const events=new Map(),seen=new Set();let cursor=null;do{const page=await send(endpoint+(cursor?'&cursor='+cursor:''));if(page.synthetic!==synthetic||!Array.isArray(page.items))throw Error('Invalid ledger page');for(const input of page.items){const record=verify(input),s=record.snapshot;if(seen.has(record.id))throw Error('Duplicate restored prediction');seen.add(record.id);if(!events.has(s.eventId))events.set(s.eventId,{id:s.eventId,nhlGameId:s.nhlGameId,date:s.date,startTime:s.startTime,capturedAt:s.capturedAt,records:[],gameRecords:[],status:'captured'});events.get(s.eventId)[s.kind==='game'?'gameRecords':'records'].push({snapshot:s,digest:ledgerDigest(JSON.stringify(s)),result:record.result,resultHistory:record.resultHistory,ledgerId:record.id,ledgerGradeDigest:record.head})}if(page.nextCursor&&(!/^[a-f0-9]{64}$/.test(page.nextCursor)||(cursor&&page.nextCursor<=cursor)))throw Error('Invalid ledger cursor');cursor=page.nextCursor}while(cursor);return {schemaVersion:1,events:[...events.values()],runs:[]}},
  close(){token=null}
 };
}
