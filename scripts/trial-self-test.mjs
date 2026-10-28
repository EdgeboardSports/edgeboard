import {createInterface} from 'node:readline';
import {randomBytes} from 'node:crypto';
import {openHostedTrialStore,executeTrialSlot} from './hosted-trial-store.mjs';
const reader=createInterface({input:process.stdin});reader.once('line',async line=>{reader.close();let store,live;try{
 const input=JSON.parse(line);store=openHostedTrialStore({token:input.token,synthetic:true});live=openHostedTrialStore({token:input.token});input.token=null;
 const now=Date.now(),startAt=new Date(Math.floor(now/86400000)*86400000).toISOString(),slotClock=Math.floor(now/3600000)*3600000+5*60000;
 const p={id:'trial-test-'+randomBytes(8).toString('hex'),startAt,days:30,cadenceMinutes:60,graceMinutes:15,sourceCommit:'a'.repeat(40),modelVersions:['goals-v1','shots-v1'],markets:['h2h','h2h_3_way','player_shots_on_goal','spreads'],stakeUnits:1,maxGamesPerDay:2};
 const created=await store.create(p);await store.activate(p.id);let sourceCalls=0;
 const config={store,trialId:p.id,sourceCommit:p.sourceCommit,clock:()=>slotClock,checkReady:async()=>{},collect:async()=>{sourceCalls++;return {counts:{capturedGames:0,newPredictions:0,gradeChanges:0,errors:0},result:{}}}};
 const first=await executeTrialSlot(config),repeat=await executeTrialSlot(config),report=await store.read(p.id);
 if(first.outcome!=='success'||!repeat.skipped||sourceCalls!==1||report.grading.length!==8||!report.slots.some(s=>s.status==='success'))throw Error('Self-test mismatch');
 const before=await store.read(p.id,{asOf:new Date(now-1000).toISOString()}).then(()=>false,()=>true);if(!before)throw Error('Receipt cutoff failed');
 const liveStatus=await live.status();console.log(JSON.stringify({synthetic:true,trialId:p.id,protocolReadBack:true,durableRunReadBack:true,duplicatePrevented:true,gradingReports:report.grading.length,cutoffVerified:before,realProviderRequests:0,liveTrialStarted:liveStatus.trialStarted,livePhase:liveStatus.phase}));
 }catch{console.error('Synthetic trial check failed; live collection unchanged.');process.exitCode=1}finally{store?.close();live?.close()}process.exit(process.exitCode||0)});
