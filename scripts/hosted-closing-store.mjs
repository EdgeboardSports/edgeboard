import {createHash} from 'node:crypto';
import {normalizeClosingAttempt,normalizeClosingObservation} from './closing-observation-schema.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
export function openHostedClosingStore({token,synthetic=false,fetchImpl=fetch}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Private closing authentication required');
 const endpoint='https://edgeboard-research-preview.speedystone18.chatgpt.site/collector/api/closing-observations?scope='+(synthetic?'synthetic':'live');
 const send=async(suffix='',body=null)=>{if(!token)throw Error('Closing store is closed');let response;try{response=await fetchImpl(endpoint+suffix,{method:body?'POST':'GET',headers:{Accept:'application/json','OAI-Sites-Authorization':'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body}:{}),redirect:'manual',signal:AbortSignal.timeout(15000)})}catch{throw Error('Closing transport unavailable')}if(!response.ok)throw Error('Closing store refused request (HTTP '+response.status+')');return response.json()};
 return {
  synthetic,
  async status(){const result=await send('&status=true');if(result.synthetic!==synthetic||typeof result.writesEnabled!=='boolean')throw Error('Invalid closing status');return result},
  async claim(input,snapshot){const payload=JSON.stringify({schemaVersion:1,type:'attempt',synthetic,attempt:normalizeClosingAttempt(input,snapshot)}),result=await send('',payload);if(result.synthetic!==synthetic||typeof result.claimed!=='boolean'||(result.claimed&&(result.persisted!==true||result.readBack!==true||result.digest!==digest(payload))))throw Error('Closing attempt was not verified');return result},
  async append(input,snapshot){const payload=JSON.stringify({schemaVersion:1,type:'observation',synthetic,observation:normalizeClosingObservation(input,snapshot,synthetic)}),result=await send('',payload);if(result.synthetic!==synthetic||result.persisted!==true||result.readBack!==true||result.digest!==digest(payload))throw Error('Closing persistence was not verified');return result},
  close(){token=null}
 };
}
