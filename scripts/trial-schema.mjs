const trialKeys=(v,keys)=>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw Error('Invalid trial fields')};
const trialIso=v=>{if(typeof v!=='string'||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)throw Error('Canonical UTC timestamp required');return v};
export function normalizeTrialProtocol(v){
 trialKeys(v,['id','startAt','days','cadenceMinutes','graceMinutes','sourceCommit','modelVersions','markets','stakeUnits','maxGamesPerDay']);
 if(!/^[a-z0-9][a-z0-9-]{7,63}$/.test(v.id||'')||v.days!==30||v.cadenceMinutes!==60||v.graceMinutes!==15||v.stakeUnits!==1||v.maxGamesPerDay!==2||!/^[a-f0-9]{40}$/.test(v.sourceCommit||''))throw Error('Fixed paper protocol required');
 trialIso(v.startAt);if(Date.parse(v.startAt)%86400000!==0)throw Error('UTC midnight trial start required');
 if(!Array.isArray(v.modelVersions)||!v.modelVersions.length||v.modelVersions.length>2||v.modelVersions.some(x=>!/^[-a-z0-9]{1,64}$/.test(x))||new Set(v.modelVersions).size!==v.modelVersions.length||!Array.isArray(v.markets)||!v.markets.length||v.markets.some(x=>!['player_shots_on_goal','h2h','h2h_3_way','spreads'].includes(x))||new Set(v.markets).size!==v.markets.length)throw Error('Fixed model and market list required');
 return {id:v.id,startAt:v.startAt,days:30,cadenceMinutes:60,graceMinutes:15,sourceCommit:v.sourceCommit,modelVersions:[...v.modelVersions].sort(),markets:[...v.markets].sort(),stakeUnits:1,maxGamesPerDay:2};
}
export function normalizeTrialRun(v,protocol){
 trialKeys(v,['trialId','slotAt','type','outcome','counts']);trialIso(v.slotAt);
 const slot=Date.parse(v.slotAt),start=Date.parse(protocol.startAt);if(v.trialId!==protocol.id||slot<start||slot>=start+30*86400000||(slot-start)%3600000||!['start','finish'].includes(v.type))throw Error('Invalid trial slot');
 if(v.type==='start'){if(v.outcome!==undefined||v.counts!==undefined)throw Error('Start cannot contain a result');return {trialId:v.trialId,slotAt:v.slotAt,type:'start'}}
 if(!['success','held','error'].includes(v.outcome))throw Error('Explicit run outcome required');trialKeys(v.counts,['capturedGames','newPredictions','gradeChanges','errors']);for(const k of ['capturedGames','newPredictions','gradeChanges','errors'])if(!Number.isSafeInteger(v.counts[k])||v.counts[k]<0||v.counts[k]>100000)throw Error('Bounded run counts required');
 if((v.outcome==='success'&&v.counts.errors!==0)||(v.outcome==='error'&&v.counts.errors<1)||(v.outcome==='held'&&Object.values(v.counts).some(n=>n!==0)))throw Error('Outcome/count mismatch');
 return {trialId:v.trialId,slotAt:v.slotAt,type:'finish',outcome:v.outcome,counts:{capturedGames:v.counts.capturedGames,newPredictions:v.counts.newPredictions,gradeChanges:v.counts.gradeChanges,errors:v.counts.errors}};
}
export function trialCoverage(protocol,activation,runs,{asOf=Date.now()}={}){
 const p=normalizeTrialProtocol(protocol),start=Date.parse(p.startAt),end=start+30*86400000;if(!Number.isFinite(asOf))throw Error('Valid cutoff required');
 const active=!!activation&&Date.parse(activation.receivedAt)<=asOf,slots=[];
 if(active)for(let at=start;at<Math.min(end,asOf+1);at+=3600000){const slotAt=new Date(at).toISOString(),entries=runs.filter(r=>r.value.slotAt===slotAt&&Date.parse(r.receivedAt)<=asOf),first=entries.find(r=>r.value.type==='start'),finish=entries.find(r=>r.value.type==='finish');slots.push({slotAt,status:finish?finish.value.outcome:first?'unfinished':asOf>=at+15*60000?'missing':'due',counts:finish?.value.counts||null})}
 const daily=[];for(let at=start;at<end;at+=86400000){const day=new Date(at).toISOString().slice(0,10),rows=slots.filter(s=>s.slotAt.startsWith(day));daily.push({day,expected:active?24:0,due:rows.length,success:rows.filter(r=>r.status==='success').length,held:rows.filter(r=>r.status==='held').length,errors:rows.filter(r=>r.status==='error').length,missing:rows.filter(r=>r.status==='missing').length,unfinished:rows.filter(r=>r.status==='unfinished').length,gradeChanges:rows.reduce((n,r)=>n+(r.counts?.gradeChanges||0),0)})}
 return {phase:!active?'planned':asOf<start?'armed':asOf<end?'in_progress':'ended',trialStarted:active&&asOf>=start,windowElapsed:active&&asOf>=end,startAt:p.startAt,endAt:new Date(end).toISOString(),expectedSlots:active?720:0,slots,daily,limitations:['UTC hourly checks are best effort; missing slots are not backfilled','A successful check with zero captures is not evidence of a no-game day','Elapsed days and run counts do not establish profitability or sufficient prediction coverage']};
}
