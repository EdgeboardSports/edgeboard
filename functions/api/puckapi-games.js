import {authenticate,ACCESS_IDENTITY,securityHeaders,denied} from '../../lib/access.js';
const PUCK_PERIOD='puckapi-activation-2026-11-04',PUCK_CAP=200;
const codes=new Set(['ANA','BOS','BUF','CGY','CAR','CHI','COL','CBJ','DAL','DET','EDM','FLA','LAK','MIN','MTL','NSH','NJD','NYI','NYR','OTT','PHI','PIT','SJS','SEA','STL','TBL','TOR','UTA','VAN','VGK','WSH','WPG']);
const puckHash=async s=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const puckReply=(v,status=200)=>securityHeaders(Response.json(v,{status}));
export function normalizePuckGames(raw){
 const rows=Array.isArray(raw?.games)?raw.games:Array.isArray(raw?.data?.games)?raw.data.games:Array.isArray(raw?.data)?raw.data:null;
 if(!rows||rows.length>=500)throw Error('Complete bounded game list required');const seen=new Set();
 return rows.map(g=>{
  const id=String(g.id);if(!/^202602\d{4}$/.test(id)||seen.has(id)||String(g.season)!=='20262027'||g.gameType!=='regular'||!codes.has(g.homeTeam)||!codes.has(g.awayTeam)||g.homeTeam===g.awayTeam||!/^\d{4}-\d{2}-\d{2}$/.test(g.gameDate)||!Number.isFinite(Date.parse(g.gameDate))||!['FUT','PRE','LIVE','CRIT','FINAL','OFF'].includes(g.gameState))throw Error('Invalid game identity');seen.add(id);
  const final=['FINAL','OFF'].includes(g.gameState);if(final&&(!Number.isSafeInteger(g.homeScore)||!Number.isSafeInteger(g.awayScore)||g.homeScore<0||g.awayScore<0||g.homeScore>30||g.awayScore>30||g.homeScore===g.awayScore))throw Error('Unverified final score');
  const period=g.lastPeriodType||g.periodDescriptor?.periodType;
  return {id,season:'20262027',gameDate:g.gameDate,homeTeam:g.homeTeam,awayTeam:g.awayTeam,gameType:'regular',gameState:g.gameState,homeScore:final?g.homeScore:null,awayScore:final?g.awayScore:null,sourceStartTime:typeof g.startTime==='string'?g.startTime:null,startTimezoneVerified:false,finalPeriodType:['REG','OT','SO'].includes(period)?period:null};
 });
}
export async function onRequestGet(context){
 const {request,env}=context,u=new URL(request.url),view=u.searchParams.get('view')||'status';
 let identity=context.data?.[ACCESS_IDENTITY];if(!identity||identity.expires<=Date.now()/1000){const a=await authenticate(request,env);if(a.response)return a.response;identity=a.identity;}
 if([...u.searchParams.keys()].some(k=>k!=='view')||u.searchParams.getAll('view').length>1||!['status','recent'].includes(view))return denied('Supported view required.',400);
 const base={provider:'PuckAPI',keyConfigured:typeof env.PUCKAPI_API_KEY==='string'&&env.PUCKAPI_API_KEY.trim().length>0,providerRequests:0,fixedCreditCap:PUCK_CAP,trialStarted:false,source:'PuckAPI independent provider; not official league data'};
 if(!base.keyConfigured)return puckReply({...base,message:'PuckAPI key missing.'},503);
 if(!env.SECURITY_DB)return puckReply({...base,message:'Shared quota storage unavailable.'},503);
 const db=env.SECURITY_DB,now=Date.now(),today=new Date(now).toISOString().slice(0,10),since=new Date(now-7*86400000).toISOString().slice(0,10),cacheId='puckapi-recent:'+today;
 let stage='quota-status',providerRequests=0,creditsReserved=0,schema=null;
 try{
  const used=await db.prepare('SELECT used FROM security_usage WHERE bucket=?').bind(PUCK_PERIOD).first();creditsReserved=used?.used||0;
  if(view==='status')return puckReply({...base,creditsReserved,accountBalanceVerified:false});
  if(now>=Date.parse('2026-12-05T13:00:00Z'))return puckReply({...base,message:'Fixed activation collection window expired.'},503);
  stage='storage-init';await db.prepare('CREATE TABLE IF NOT EXISTS puckapi_evidence(id TEXT PRIMARY KEY,captured_at TEXT NOT NULL,payload TEXT NOT NULL,digest TEXT NOT NULL)').run();
  stage='storage-triggers';await db.prepare("CREATE TRIGGER IF NOT EXISTS puckapi_evidence_no_update BEFORE UPDATE ON puckapi_evidence BEGIN SELECT RAISE(ABORT,'Evidence is append-only'); END").run();
  await db.prepare("CREATE TRIGGER IF NOT EXISTS puckapi_evidence_no_delete BEFORE DELETE ON puckapi_evidence BEGIN SELECT RAISE(ABORT,'Evidence is append-only'); END").run();
  stage='cache-read';const old=await db.prepare('SELECT payload,digest FROM puckapi_evidence WHERE id=?').bind(cacheId).first();
  if(old){if(await puckHash(old.payload)!==old.digest)throw Error('Integrity');return puckReply({...base,cached:true,snapshot:JSON.parse(old.payload),digest:old.digest,creditsReserved});}
  const rawId='puckapi-raw:'+today;let envelope;const rawRow=await db.prepare('SELECT payload,digest FROM puckapi_evidence WHERE id=?').bind(rawId).first();
  if(rawRow){if(await puckHash(rawRow.payload)!==rawRow.digest)throw Error('Integrity');envelope=JSON.parse(rawRow.payload);}
  else{
   const reserve=async(bucket,cost,cap)=>db.prepare('INSERT INTO security_usage(bucket,used) VALUES(?,?) ON CONFLICT(bucket) DO UPDATE SET used=used+excluded.used WHERE used+excluded.used<=? RETURNING used').bind(bucket,cost,cap).first();
   stage='daily-reservation';if(!await reserve('puckapi-recent-attempt:'+today,1,2))return puckReply({...base,message:'Today’s request limit is reached; no automatic retry.'},429);
   stage='period-reservation';if(!await reserve(PUCK_PERIOD,5,PUCK_CAP))return puckReply({...base,message:'Fixed provider credit cap reached.'},429);creditsReserved+=5;
   stage='provider-request';providerRequests=1;const r=await fetch('https://mcp.puckapi.com/v1/get_games',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':env.PUCKAPI_API_KEY},body:JSON.stringify({season:'20262027',game_type:'regular',date_from:since,date_to:today,limit:500}),redirect:'manual',signal:AbortSignal.timeout(20000)});
   if(!r.ok)return puckReply({...base,providerRequests,creditsReserved,upstreamStatus:r.status,message:'Provider refused recent-game request; no automatic retry.'},502);
   stage='provider-json';const text=await r.text();if(text.length>1000000)throw Error('Source bound');const raw=JSON.parse(text),balance=r.headers.get('x-credits-remaining');
   // Retain an authenticated response for parser repair without spending more credits.
   // Drop credential-shaped fields and refuse any provider echo of our actual secret.
   if(text.includes(env.PUCKAPI_API_KEY))throw Error('Secret echo');
   const clean=JSON.parse(JSON.stringify(raw,(key,value)=>/api.?key|authorization|password|secret|token/i.test(key)?undefined:value));
   envelope={retrievedAt:new Date().toISOString(),sourceResponseSha256:await puckHash(text),raw:clean,credentialFieldsExcluded:true,providerRemainingCredits:balance!==null&&/^\d+$/.test(balance)?Number(balance):null};
   stage='response-persistence';const p=JSON.stringify(envelope);await db.prepare('INSERT INTO puckapi_evidence(id,captured_at,payload,digest) VALUES(?,?,?,?)').bind(rawId,envelope.retrievedAt,p,await puckHash(p)).run();
  }
  const raw=envelope.raw;schema={topLevelFields:raw&&typeof raw==='object'?Object.keys(raw).slice(0,30):[],dataFields:raw?.data&&typeof raw.data==='object'?Object.keys(raw.data).slice(0,30):[],firstGameFields:(raw?.games?.[0]||raw?.data?.games?.[0]||raw?.data?.[0])?Object.keys(raw?.games?.[0]||raw?.data?.games?.[0]||raw?.data?.[0]).slice(0,60):[]};
  stage='game-schema';const games=normalizePuckGames(raw);if(games.some(g=>g.gameDate<since||g.gameDate>today))throw Error('Date range mismatch');
  const snapshot={retrievedAt:envelope.retrievedAt,dateFrom:since,dateTo:today,games,sourceResponseSha256:envelope.sourceResponseSha256,providerRemainingCredits:envelope.providerRemainingCredits,limitations:['Start-time timezone is unverified unless supplied separately by a verified event source','Missing period metadata remains unknown; regulation-dependent training and settlement must remain held','Current provider records may include corrections; this response receipt is preserved']};
  stage='snapshot-persistence';const payload=JSON.stringify(snapshot),digest=await puckHash(payload);await db.prepare('INSERT INTO puckapi_evidence(id,captured_at,payload,digest) VALUES(?,?,?,?)').bind(cacheId,snapshot.retrievedAt,payload,digest).run();const saved=await db.prepare('SELECT payload,digest FROM puckapi_evidence WHERE id=?').bind(cacheId).first();if(!saved||saved.payload!==payload||saved.digest!==digest)throw Error('Persistence');
  return puckReply({...base,providerRequests,creditsReserved,persisted:true,readBack:true,digest,snapshot});
 }catch(e){return puckReply({...base,providerRequests,creditsReserved,failureStage:stage,failureType:['TypeError','TimeoutError','AbortError','SyntaxError'].includes(e?.name)?e.name:'ValidationError',...(schema?{schema}:{}),message:'Provider response or persistence could not be verified; no model or trial activation.'},502);}
}
