import {forwardAppend,forwardHash} from './forward-testing.js';
import {shadowNotification} from './shadow-operations.js';
import {modelBModel} from './model-b-selection.js';
import {shadowOddsDB,shadowLateOdds} from './shadow-late-odds.js';
export async function modelBRoute(request,env,config,now=Date.now()) {
  try {
    const view={...env,DB:await shadowOddsDB(env.DB,now)};
    if(new URL(request.url).pathname.endsWith('/refresh-odds')) {
      if(request.method!=='POST')return Response.json({message:'POST required'},{status:405});
      const response=await modelBModel(new Request(new URL('/collector/api/model-b',request.url)),view,config,now);
      if(!response.ok)return response;
      const report=await response.json();
      const priceOnly=new Set(['fresh_pregame_quote_required','verified_odds_and_budget_required','valid_price_required','draftkings_two_way_quote_required','verified_two_way_quote_unavailable','complete_two_way_pair_required']);
      if(!report.currentDecisions.some(g=>Date.parse(g.startAt)>now+60000&&g.holds.every(h=>priceOnly.has(h))))return Response.json({skipped:true,providerRequests:0,reason:'critical_inputs_unavailable',games:report.currentDecisions});
      // Provider budget, authorization, window and request validation remain in the existing collector.
      return shadowLateOdds(request,env,config,now);
    }
    return modelBModel(request,view,config,now);
  }catch{return Response.json({message:'Model B source integrity unavailable'},{status:503});}
}

export async function modelBNotification(request,env,config,now=Date.now()) {
  const url=new URL(request.url);
  if(!['GET','POST'].includes(request.method)||url.search)return Response.json({message:'GET or POST without query required'},{status:400});
  if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')||(await request.clone().text()).trim()!=='{}'))return Response.json({message:'Same-origin empty JSON required'},{status:403});
  const response=await modelBRoute(new Request(new URL('/collector/api/model-b',request.url)),env,config,now);
  if(!response.ok)return response;
  const report=await response.json();
  const evidence=report.sources?.odds?await env.DB.prepare('SELECT id,namespace,captured_at,payload,digest FROM collector_evidence WHERE id=?').bind(report.sources.odds).first():null;
  if(evidence&&await forwardHash(evidence.payload)!==evidence.digest)return Response.json({message:'Odds report integrity'},{status:503});
  const actualFreshPull=!!evidence&&Date.parse(evidence.captured_at)<=now&&now-Date.parse(evidence.captured_at)<30*60000;
  const packet={version:report.version,actualFreshPull,pullEvidenceId:actualFreshPull?evidence.id:null,pullAt:actualFreshPull?evidence.captured_at:null,preparedAt:new Date(now).toISOString(),timeZone:'America/New_York',
    title:'Edgeboard Model B evaluation',rankings:report.rankings,
    sections:[{model:'B • experimental paper',evaluatedAt:new Date(now).toISOString(),games:report.currentDecisions.map(g=>({eventId:g.eventId,game:g.away+' @ '+g.home,holds:g.holds,decision:g.holds.length?'data_held':g.selection?'qualifies':'no_bet',choices:g.choices}))}],
    selections:report.records.filter(r=>r.prediction.day===new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)),
    deliveryStatus:'prepared_not_device_verified',instructions:'Rankings are research only. Only primarySelected ledger records are paper selections; no automated wagers.'};
  let evidenceId=null;if(request.method==='POST'){evidenceId='model-b-notification:'+await forwardHash(JSON.stringify(packet));const ack=await forwardAppend(env.DB,evidenceId,'shadow-notification-v1',null,packet,now);if(!ack.identical)throw Error('Notification readback');}
  return Response.json({...report,packet,evidenceId,persisted:!!evidenceId}, {headers:{'Cache-Control':'no-store'}});
}

export async function modelBCombinedNotification(request,env,config,now=Date.now()) {
 if(new URL(request.url).pathname.endsWith('/b'))return modelBNotification(request,env,config,now);
 const legacy=await shadowNotification(request,env,config,now);if(!legacy.ok)return legacy;
 const value=await legacy.json(),b=await modelBNotification(new Request(new URL('/collector/api/shadow-notification/b',request.url)),env,config,now);
 if(!b.ok)return Response.json({...value,modelBReportAvailable:false});
 const current=await b.json();return Response.json({...value,packet:{...value.packet,sections:[...(value.packet.sections||[]).filter(s=>!s.model.startsWith('B')), ...current.packet.sections],rankings:current.rankings},modelBReport:current,modelBReportAvailable:true}, {headers:{'Cache-Control':'no-store'}});
}
