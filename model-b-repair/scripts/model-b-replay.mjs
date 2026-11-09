import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {officialBoard} from '../worker/official-paper.js';
import {modelBBoard} from '../worker/model-b-board.js';
import {factorShadowEvaluate} from '../worker/shadow-factor-model.js';
import {modelBEvaluate} from '../worker/model-b-selection.js';
import {modelBRankings} from '../worker/model-b-rankings.js';
import {shadowOddsDB} from '../worker/shadow-late-odds.js';
import {decodePlayerPayload} from '../worker/player-inputs.js';
import {forwardDate} from '../worker/forward-core.js';
const input=JSON.parse(readFileSync(process.argv[2])),hash=x=>createHash('sha256').update(x).digest('hex');
if(hash(JSON.stringify(input.rows))!==input.rowsSha256)throw Error('Snapshot digest mismatch');
const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE collector_evidence(id TEXT PRIMARY KEY,namespace TEXT,event_id TEXT,captured_at TEXT,payload TEXT,digest TEXT)');
for(const row of input.rows){if(/^[a-f0-9]{64}$/.test(row.digest)&&hash(row.payload)!==row.digest)throw Error('Evidence digest mismatch');sql.prepare('INSERT INTO collector_evidence VALUES(?,?,?,?,?,?)').run(row.id,row.namespace,row.event_id,row.captured_at,row.payload,row.digest);}
const latest=(ns,at)=>input.rows.filter(r=>r.namespace===ns&&r.captured_at<=at).sort((a,b)=>a.captured_at.localeCompare(b.captured_at)||a.id.localeCompare(b.id)).at(-1);
const val=r=>r?JSON.parse(r.payload):null,parse=(ns,at)=>val(latest(ns,at));
const originalBytes=JSON.stringify(sql.prepare('SELECT * FROM collector_evidence ORDER BY id').all());
function equivalent(a,b){if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=1e-12;if(a===b)return true;if(!a||!b||typeof a!==typeof b||Array.isArray(a)!==Array.isArray(b))return false;if(typeof a!=='object')return false;const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&equivalent(a[k],b[k]));}
const traces=[],summary={runs:0,exactOriginalReplays:0,numericallyEquivalentReplays:0,evaluations:0,captureEvaluations:0,originalQualifying:0,correctedQualifying:0,changedCaptureOpportunities:0,rankedCaptureRuns:0};
const runs=input.rows.filter(r=>r.namespace==='shadow-b-v2-runs'&&r.captured_at>='2026-11-04').sort((a,b)=>a.captured_at.localeCompare(b.captured_at));
const rules=JSON.parse(readFileSync('data/paper-rules.json'));
for(const run of runs){const saved=val(run),at=saved.checkedAt,now=Date.parse(at);sql.exec('DROP VIEW IF EXISTS replay_evidence');sql.exec("CREATE TEMP VIEW replay_evidence AS SELECT * FROM collector_evidence WHERE captured_at <= '"+at+"'");
 const DB={prepare(q){q=q.replaceAll('collector_evidence','replay_evidence');return {bind(...v){return {first:async()=>sql.prepare(q).get(...v),all:async()=>({results:sql.prepare(q).all(...v)})}},first:async()=>sql.prepare(q).get(),all:async()=>({results:sql.prepare(q).all()})}}};
 const view=await shadowOddsDB(DB,now),board=await officialBoard(view,rules,now),newBoard=await modelBBoard(view,rules,now);
 const row=await view.prepare('SELECT id,namespace,captured_at,payload,digest FROM collector_evidence WHERE namespace=? ORDER BY captured_at DESC,id DESC LIMIT 1').bind('free-odds-cache').first(),odds=val(row);
 const playerPayload=parse('prop-player-inputs',at),context={stats:parse('forward-research-inputs',at)?.stats,puck:parse('puckapi-v1-receipts',at)?.snapshot,snapshot:parse('shadow-factor-inputs-v1',at),players:playerPayload&&parse('prop-player-status',at)?.held===false?(await decodePlayerPayload(playerPayload)).stats:null,claims:input.rows.filter(r=>r.namespace==='pregame-v1-evidence'&&r.captured_at<=at&&now-Date.parse(r.captured_at)<48*3600000).map(val)};
 if(parse('forward-research-status',at)?.held!==false)for(const b of [board,newBoard])b.globalHolds.push('research_source_refresh_failed');
 for(const b of [board,newBoard])for(const e of b.evaluations)e.holds=[...new Set([...e.holds,...b.globalHolds])];
 const old=factorShadowEvaluate(board,odds,forwardDate(now),context),fixed=modelBEvaluate(newBoard,odds,forwardDate(now),context);
 const comparable=old.map(({modelInputs,...g})=>g),exact=JSON.stringify(comparable)===JSON.stringify(saved.decisions);
 summary.runs++;summary.exactOriginalReplays+=exact;summary.numericallyEquivalentReplays+=equivalent(comparable,saved.decisions);summary.evaluations+=old.length;
 if(saved.phase==='capture'){summary.captureEvaluations+=old.length;summary.originalQualifying+=old.filter(g=>g.selection).length;summary.correctedQualifying+=fixed.filter(g=>g.selection).length;summary.rankedCaptureRuns+=modelBRankings(fixed,at).topThree.length>0;summary.changedCaptureOpportunities+=fixed.filter(g=>g.selection&&!old.find(o=>o.eventId===g.eventId)?.selection).length;}
 traces.push({evidenceId:run.id,capturedAt:at,phase:saved.phase,exactOriginalReplay:exact,captureHolds:saved.captureHolds,sources:board.sources,original:saved.decisions,reconstructed:comparable,corrected:fixed.map(({modelInputs,...g})=>g),rankings:modelBRankings(fixed,at)});
}
if(JSON.stringify(sql.prepare('SELECT * FROM collector_evidence ORDER BY id').all())!==originalBytes)throw Error('History mutated');
const historical=input.rows.filter(r=>['shadow-b-v1-runs','shadow-b-v3-forecasts','slate-assessments-v1','shadow-notification-v1'].includes(r.namespace)&&r.captured_at>='2026-11-04').map(r=>({id:r.id,namespace:r.namespace,capturedAt:r.captured_at,value:val(r)}));
const report={sourceExportedAt:input.exportedAt,sourceRows:input.rowCount,sourceSha256:hash(readFileSync(process.argv[2])),summary,traces,historical,historyUnchanged:true,providerRequests:0,interpretation:'Counterfactual diagnostic replay only. No historical picks are created. Legacy v1 runs and v3 frozen forecasts retained as separate evidence, not combined with active v2 selections.'};
writeFileSync(process.argv[3],JSON.stringify(report,null,2));console.log(JSON.stringify(summary));sql.close();
