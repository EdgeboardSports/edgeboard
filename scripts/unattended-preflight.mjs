import {openHostedEvidenceStore} from './hosted-evidence-store.mjs';
import {randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const APP='https://edgeboard-8fl.pages.dev';
// Supply a freshly acquired owner-private Sites service token through stdin only.
// This command never logs the token, saves credentials, fetches odds, or enables collection.
export async function unattendedPreflight({token,fetchImpl=fetch,clock=()=>Date.now()}={}){
 const now=clock(),store=openHostedEvidenceStore({token,fetchImpl,synthetic:true});
 const input={event:{id:randomBytes(16).toString('hex'),nhlGameId:'2026020100',homeAbbrev:'TST',awayAbbrev:'SYN',startTime:new Date(now+3600000).toISOString()},capturedAt:new Date(now).toISOString(),phase:'discovery',sourceCommit:null};
 let storage;
 try{const first=await store.append(input),repeat=await store.append(input);if(!first.inserted||repeat.inserted||first.hash!==repeat.hash)throw Error('Storage verification failed');storage={authenticated:true,persisted:true,duplicateVerified:true,synthetic:true}}finally{store.close()}
 // Never send the Sites service token to the separate Edgeboard origin.
 let app;
 try{
  const response=await fetchImpl(APP+'/api/feed-status',{headers:{Accept:'application/json'},redirect:'manual',signal:AbortSignal.timeout(15000)});
  if(response.status===401||response.status===403||response.status===303||response.status===302)app={authenticated:false,state:'service_access_not_configured'};
  else if(!response.ok)app={authenticated:false,state:'unavailable'};
  else{
   const result=await response.json();
   // An anonymous success is a privacy regression, never a reason to collect.
   app={authenticated:false,state:result?.schedule&&result?.odds?'unexpected_anonymous_access':'unexpected_response'};
  }
 }catch{app={authenticated:false,state:'unavailable'}}
 return {checkedAt:new Date(now).toISOString(),storage,edgeboardApi:app,collectionReady:false,collection:'paused',providerRequests:0,notes:['Storage service access and data-source access are separate','No unattended Edgeboard API credential was configured or used','No live feeds, schedule, authentication settings, or quotas were changed']};
}
async function main(){
 let bytes=0,chunks=[];
 for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>16384)throw Error('Input too large');chunks.push(chunk)}
 let input;try{input=JSON.parse(Buffer.concat(chunks).toString())}catch{throw Error('JSON service credential input required')}
 const result=await unattendedPreflight({token:input.token});input=null;
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Unattended preflight failed; no collection enabled.');process.exitCode=1});
