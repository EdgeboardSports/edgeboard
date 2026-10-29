// Generate entirely fabricated research artifacts for CI. Never fetches sportsbook data.
import {writeFile,mkdir} from 'node:fs/promises';
import {createHistoricalEvidenceLedger} from './historical-evidence-ledger.mjs';
import {renderResearchView} from './historical-research-view.mjs';
const ledger=createHistoricalEvidenceLedger();
const event='fictional-event-1',market='player_shots_on_goal',subjectId='fictional-player-1',line=2.5;
const base={eventId:event,market,subjectId,line,side:'Over'};
ledger.append({type:'prediction',data:{...base,id:'fictional-pick-1',probability:.6,predictedAt:'2026-01-01T18:00:00Z',startTime:'2026-01-01T19:00:00Z'}});
ledger.append({type:'quote',data:{...base,bookmaker:'fictional-book',decimal:2.1,observedAt:'2026-01-01T17:50:00Z',source:'synthetic-fixture'}});
ledger.append({type:'quote',data:{...base,side:'Under',bookmaker:'fictional-book',decimal:1.8,observedAt:'2026-01-01T17:50:00Z',source:'synthetic-fixture'}});
ledger.append({type:'settlement',data:{...base,predictionId:'fictional-pick-1',result:'win',gradedAt:'2026-01-02T01:00:00Z'}});
const report=ledger.evaluate();
if(!report.dataIsSynthetic||!report.evidence.verified)throw Error('Research fixture provenance failed');
await mkdir('research-output',{recursive:true});
await writeFile('research-output/synthetic-odds-report.json',JSON.stringify(report,null,2));
await writeFile('research-output/synthetic-odds-view.html',renderResearchView(report));
console.log(JSON.stringify({mode:report.mode,matched:report.counts.matched,settled:report.summary.settled,evidence:report.evidence.verified,synthetic:true}));
