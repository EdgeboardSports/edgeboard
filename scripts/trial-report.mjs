import {openHostedTrialStore} from './hosted-trial-store.mjs';
let bytes=0,chunks=[];for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>16384)throw Error('Credential input too large');chunks.push(chunk)}
const input=JSON.parse(Buffer.concat(chunks).toString());const store=openHostedTrialStore({token:input.token});input.token=null;
try{console.log(JSON.stringify(await store.read(process.argv[2],{...(process.argv[3]?{asOf:process.argv[3]}:{}),...(process.argv[4]?{day:process.argv[4]}:{})}),null,2))}finally{store.close()}
