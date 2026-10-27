import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {onRequestGet} from '../functions/api/feed-status.js';
import {ACCESS_IDENTITY} from '../lib/access.js';
const identity={[ACCESS_IDENTITY]:{email:'test-owner',expires:Date.now()/1000+1000}};
const context=env=>({env,request:new Request('https://edgeboard.test/api/feed-status'),data:identity});
let outbound=0;const oldFetch=globalThis.fetch;globalThis.fetch=()=>{outbound++;throw Error('No external calls allowed')};
try{
 assert.equal((await onRequestGet({...context({}),data:{}})).status,503);
 const response=await onRequestGet(context({THE_ODDS_API_KEY:'must-never-appear'}));const text=await response.text();assert(!text.includes('must-never-appear'));assert.equal(response.headers.get('Cache-Control'),'private, no-store');
 const missing=JSON.parse(text);assert.equal(missing.schedule.state,'paused');assert.equal(missing.odds.state,'blocked');assert(missing.odds.blockers.some(x=>x.includes('database')));
 const env={ALLOW_NHL_FEED:'true',ALLOW_ESPN_FEED:'true',ALLOW_ODDS_FEED:'true',THE_ODDS_API_KEY:'secret',ODDS_BUDGET_PERIOD:'2026-10-27',SECURITY_DB:{prepare:()=>({first:async()=>({remaining_credits:120})})}};
 assert.equal((await (await onRequestGet(context(env))).json()).odds.state,'configured');
 env.SECURITY_DB.prepare=()=>({first:async()=>{throw Error('db down')}});assert.equal((await (await onRequestGet(context(env))).json()).odds.state,'blocked');assert.equal(outbound,0);
}finally{globalThis.fetch=oldFetch}
const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const source=html.match(/<script type="module">([\s\S]*?)<\/script>/)[1].replace(/^import .*;$/gm,'').replace('else load();','else globalThis.loaded=load();');
const node=()=>({textContent:'',value:'',children:[],append(...v){this.children.push(...v)},replaceChildren(...v){this.children=v}});
async function homepage(schedule,events){const nodes=new Map();const document={getElementById:id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)}};
 const sandbox={document,Date,URLSearchParams,location:{search:''},el:(tag,text)=>Object.assign(node(),{textContent:text}),icon:node,cleanName:s=>s?.toLowerCase()||'',fetch:async path=>{
 const data=path.includes('nhl-schedule')?schedule:path.includes('nhl-events')?events:path.includes('paper-ledger')?{events:[],lastRunAt:new Date().toISOString()}:path.includes('feed-status')?{automation:{state:'paused',message:'Scheduled collection paused'}}:{};
 return {ok:!data.message,status:data.message?503:200,json:async()=>data};
 }};vm.runInNewContext(source,sandbox);await sandbox.loaded;return nodes;}
const blocked=await homepage({message:'Schedule paused'},{message:'Quota database missing'});assert.equal(blocked.get('slate-count').textContent,'—');assert.match(blocked.get('status').textContent,/unavailable/);assert.match(blocked.get('feed-health').textContent,/Quota database missing/);assert.match(blocked.get('automation').textContent,/paused/);
const empty=await homepage({games:[]},{events:[]});assert.equal(empty.get('slate-count').textContent,0);assert.match(empty.get('status').textContent,/0 matchups/);
console.log('Passed protected/no-network diagnostics, secret redaction, missing/broken DB, unavailable vs empty slate, and paused heartbeat.');
