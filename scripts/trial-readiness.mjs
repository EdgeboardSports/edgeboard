import {pathToFileURL} from 'node:url';
const ORIGIN='https://edgeboard-research-preview.speedystone18.chatgpt.site';
// Readiness is not an activation command. No provider requests or live writes.
export async function trialReadiness({token,start,fetchImpl=fetch,clock=()=>Date.now(),scheduleVerified=false}={}){
 if(typeof token!=='string'||!token.trim()||/[\r\n]/.test(token))throw Error('Private service access required');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(start||'')||!Number.isFinite(Date.parse(start))||new Date(start).toISOString().slice(0,10)!==start)throw Error('Valid trial start date required');
 const checkedAt=new Date(clock()).toISOString(),end=new Date(Date.parse(start)+30*86400000).toISOString();
 const read=async(path,method='GET')=>{const response=await fetchImpl(ORIGIN+path,{method,headers:{Accept:'application/json','OAI-Sites-Authorization':'Bearer '+token},redirect:'manual',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Private readiness request refused (HTTP '+response.status+')');return response.json()};
 try{
  const sources=await read('/collector/api/source-readiness','POST');
  const ledger=await read('/collector/api/prediction-ledger?scope=live');
  const closing=await read('/collector/api/closing-observations?scope=live&status=true');
  const report=await read('/collector/api/performance?scope=live&selection=all&days=30&start='+start+'&asOf='+encodeURIComponent(checkedAt));
  if(report.synthetic!==false||report.scope!=='live'||report.audit?.integrityVerified!==true||report.audit?.providerRequests!==0||report.window?.start!==start+'T00:00:00.000Z'||report.window?.end!==end||report.asOf!==checkedAt||!Number.isSafeInteger(report.summary?.predictions)||report.summary.predictions<0||!Array.isArray(report.byCaptureDay)||ledger.synthetic!==false||!Array.isArray(ledger.items)||closing.synthetic!==false)throw Error('Unverified private report');
  const fresh=Number.isFinite(Date.parse(sources.checkedAt))&&Math.abs(Date.parse(sources.checkedAt)-Date.parse(checkedAt))<=60000;
  const gates={authenticatedSources:sources.verified===true&&sources.authentication==='collector'&&sources.auditPersisted===true&&fresh,feeds:sources.schedule==='enabled'&&sources.odds==='configured',budget:Number.isSafeInteger(sources.availableCredits)&&sources.availableCredits>=1&&Number.isSafeInteger(sources.protectedRemainingCredits)&&sources.protectedRemainingCredits>=101,privateLedgerReadable:true,controlledCaptureVerified:false,privateClosingWrites:closing.writesEnabled===true,scheduleVerified:scheduleVerified===true};
  const blockers=Object.entries(gates).filter(([,ready])=>!ready).map(([name])=>name);
  const captureDays=new Set();for(const day of report.byCaptureDay){if(!/^\d{4}-\d{2}-\d{2}$/.test(day.name||'')||day.name<start||day.name>=end.slice(0,10)||day.name>checkedAt.slice(0,10)||!Number.isSafeInteger(day.predictions)||day.predictions<1)throw Error('Invalid capture coverage');captureDays.add(day.name)}
  return {checkedAt,proposedWindow:{start:start+'T00:00:00.000Z',end},readyForControlledCapture:false,readyForScheduledTrial:blockers.length===0,trialStarted:false,gates,blockers,evidence:{livePredictions:report.summary.predictions,captureDays:captureDays.size,settled:report.summary.settled,unresolved:report.summary.unresolved,closingMatched:report.clv?.matched??0},providerRequests:0,limitations:['Readiness does not activate or start a trial','Capture days do not prove scheduler completeness; no-game days and outages require run records','A bounded real pregame capture, grading and readback must pass before scheduling','No betting profitability or statistical significance is established']};
 }finally{token=null}
}
async function main(){
 let size=0,chunks=[];for await(const chunk of process.stdin){size+=chunk.length;if(size>16384)throw Error('Input too large');chunks.push(chunk)}
 const input=JSON.parse(Buffer.concat(chunks).toString());const result=await trialReadiness({token:input.token,start:process.argv[2]});input.token=null;console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Private trial readiness failed; collection unchanged.');process.exitCode=1});
