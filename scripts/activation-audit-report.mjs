import {createInterface} from 'node:readline';
import {activationAudit} from './activation-audit.mjs';
// Supply token and the native get_site automations result through protected stdin only.
const reader=createInterface({input:process.stdin});reader.once('line',async line=>{reader.close();try{
 if(Buffer.byteLength(line)>65536)throw Error('Input too large');const input=JSON.parse(line);
 if(typeof input.token!=='string'||!input.token.trim()||/[\r\n]/.test(input.token))throw Error('Private service access required');
 const response=await fetch('https://edgeboard-research-preview.speedystone18.chatgpt.site/collector/api/source-readiness',{method:'POST',headers:{Accept:'application/json','OAI-Sites-Authorization':'Bearer '+input.token},redirect:'manual',signal:AbortSignal.timeout(30000)});input.token=null;
 if(!response.ok)throw Error('Readiness request refused');const readiness=await response.json();if(readiness.providerRequests!==0||readiness.auditPersisted!==true)throw Error('Unverified source audit');
 console.log(JSON.stringify(activationAudit({startAt:process.argv[2],readiness,automations:input.automations}),null,2));
 }catch{console.error('Activation audit failed; no credential, schedule or trial changed.');process.exitCode=1}process.exit(process.exitCode||0)});
