import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openHostedPredictionLedger} from '../scripts/hosted-prediction-ledger.mjs';
import {normalizeLedgerPrediction} from '../scripts/prediction-ledger-schema.mjs';
import {ledgerFixture} from './fixtures/paper-ledger.mjs';
import {runPaper} from '../scripts/paper-runner.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex'),fixture=ledgerFixture(Date.now()),normalized=normalizeLedgerPrediction(fixture);
assert(!JSON.stringify(normalizeLedgerPrediction({...fixture,headers:{Authorization:'secret'},modelInputs:{...fixture.modelInputs,secret:'never-store'}})).includes('secret'));
assert.throws(()=>openHostedPredictionLedger(),/authentication/);
let record,posts=0;const transport=async(url,options)=>{
 assert.equal(new URL(url).origin,'https://edgeboard-research-preview.speedystone18.chatgpt.site');assert.equal(options.redirect,'manual');assert.equal(options.headers['OAI-Sites-Authorization'],'Bearer test-only');
 if(options.method==='POST'){posts++;const envelope=JSON.parse(options.body),id=hash(envelope.snapshot.id),digest=hash(options.body);record={synthetic:true,id,snapshot:envelope.snapshot,digest,receivedAt:new Date().toISOString(),grades:[],head:null,result:{state:'pending'},resultHistory:[]};return Response.json({persisted:true,readBack:true,synthetic:true,id,digest})}
 return Response.json(new URL(url).searchParams.has('id')?record:{synthetic:true,items:[record],nextCursor:null});
};
const store=openHostedPredictionLedger({token:'test-only',synthetic:true,fetchImpl:transport});const ack=await store.appendPrediction(fixture);assert.equal(ack.id,hash(normalized.id));assert.deepEqual((await store.read(ack.id)).snapshot,normalized);const restored=await store.restore();assert.equal(restored.events[0].records[0].ledgerId,ack.id);assert.equal(restored.events[0].records[0].digest,hash(JSON.stringify(normalized)));
record.snapshot.probability.over=.7;record.snapshot.probability.under=.3;await assert.rejects(store.read(ack.id),/integrity/);store.close();await assert.rejects(store.read(ack.id),/closed/);
const rejected=openHostedPredictionLedger({token:'test-only',synthetic:true,fetchImpl:async()=>new Response('{}',{status:503})});await assert.rejects(rejected.appendPrediction(fixture));assert.equal(posts,1);
// Grading cannot update in-memory settlement if durable persistence fails.
const now=Date.now(),fresh={snapshot:normalized,digest:hash(JSON.stringify(normalized)),result:{state:'pending'},ledgerId:hash(normalized.id),ledgerGradeDigest:null};
const ledger={events:[{id:normalized.eventId,nhlGameId:normalized.nhlGameId,date:normalized.date,startTime:normalized.startTime,records:[fresh],gameRecords:[]}],runs:[]};
const client=async path=>path.startsWith('/api/nhl-schedule')?{games:[{id:normalized.nhlGameId,gameState:'OFF'}]}:path.startsWith('/api/nhl-game-log')?{games:[{gameId:normalized.nhlGameId,shots:4}]}:{events:[]};
await runPaper(ledger,client,{clock:()=>now,ledgerStore:{appendGrade:async()=>{throw Error('storage unavailable')}}});assert.equal(fresh.result.state,'pending');assert(ledger.runs.at(-1).errors.some(x=>x.includes('storage unavailable')));
const history=[];await runPaper(ledger,client,{clock:()=>now+1000,ledgerStore:{appendGrade:async input=>{history.push(input);return {digest:'e'.repeat(64)}}}});assert.equal(fresh.result.state,'win');assert.equal(fresh.ledgerGradeDigest,'e'.repeat(64));assert.equal(history.length,1);
console.log('Private ledger adapter: canonical projection, digest verification, restore, credential isolation and persistence-before-grading passed');
const {spawnSync}=await import('node:child_process');const {readFileSync}=await import('node:fs');const ledgerFile=new URL('../data/paper-ledger.json',import.meta.url),before=readFileSync(ledgerFile,'utf8');
const blocked=spawnSync(process.execPath,['scripts/paper-runner.mjs'],{cwd:new URL('../',import.meta.url),env:{EDGEBOARD_COLLECTION_APPROVED:'true'},encoding:'utf8'});assert.equal(blocked.status,1);assert(blocked.stderr.includes('public ledger writes are disabled'));assert.equal(readFileSync(ledgerFile,'utf8'),before);
