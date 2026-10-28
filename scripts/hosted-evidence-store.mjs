import {createHash} from 'node:crypto';
import {normalizeEvidence} from './evidence-store.mjs';
const ORIGIN='https://edgeboard-research-preview.speedystone18.chatgpt.site';
// The authenticated transport is injected by the private collector host, never saved in source.
export function openHostedEvidenceStore({token,fetchImpl=fetch}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Private storage authentication required');
 return {
  async append(input){
   if(!token)throw Error('Private evidence store is closed');
   const record=normalizeEvidence(input),payload=JSON.stringify(record);
   const digest=createHash('sha256').update(payload).digest('hex');
   let response;
   try{response=await fetchImpl(ORIGIN+'/collector/api/evidence',{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+token},body:payload,redirect:'manual',signal:AbortSignal.timeout(15000)})}catch{throw Error('Private evidence transport unavailable')}
   if(!response.ok)throw Error('Private evidence storage refused capture (HTTP '+response.status+')');
   let result;try{result=await response.json()}catch{throw Error('Invalid private storage acknowledgment')}
   if(result.persisted!==true||result.readBack!==true||result.digest!==digest)throw Error('Private evidence persistence was not verified');
   return {inserted:result.duplicate!==true,hash:digest};
  },
  close(){token=null}
 };
}
