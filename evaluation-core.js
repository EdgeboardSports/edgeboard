// Provider-neutral research metrics. No wagering or data acquisition occurs here.
export function closingValue(snapshot,observations,now=Date.now()){
 const start=Date.parse(snapshot.startTime),capture=Date.parse(snapshot.capturedAt),q=snapshot.quote;
 if(!Number.isFinite(start)||!Number.isFinite(capture)||capture>=start||now<start||!Number.isFinite(q?.decimal)||q.decimal<=1)return null;
 const same=o=>o.eventId===snapshot.eventId&&o.market===(snapshot.market||'player_shots_on_goal')&&o.side===snapshot.side&&(o.playerId??null)===(snapshot.playerId??null)&&(o.line??null)===(snapshot.line??null)&&o.bookmaker===q.bookmaker;
 const eligible=observations.filter(o=>same(o)&&((o.receivedAt===undefined||o.receivedAt===null)||(Number.isFinite(Date.parse(o.receivedAt))&&Date.parse(o.receivedAt)<=now))&&Number.isFinite(o.decimal)&&o.decimal>1&&Date.parse(o.observedAt)<=now&&Date.parse(o.observedAt)>=capture&&Date.parse(o.observedAt)<start&&Date.parse(o.quoteAt)<=Date.parse(o.observedAt)&&Date.parse(o.quoteAt)>=Date.parse(o.observedAt)-15*60000).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const last=eligible.at(-1);
 // Conflicting prices at the latest observation time are unknown, never chosen by input order.
 if(last&&new Set(eligible.filter(o=>Date.parse(o.observedAt)===Date.parse(last.observedAt)).map(o=>o.decimal)).size>1)return null;
 if(!last||start-Date.parse(last.observedAt)>15*60000)return null;
 return {closingDecimal:last.decimal,observedAt:last.observedAt,priceRatio:q.decimal/last.decimal-1,impliedMovement:1/last.decimal-1/q.decimal,definition:'Same book/selection/line; last verified quote in final 15 pregame minutes. Positive means better recommendation price.'};
}
export function paperMetrics(records){
 const settled=records.filter(r=>['win','loss','push'].includes(r.result?.state)),decisions=settled.filter(r=>r.result.state!=='push');let score=0,log=0,n=0;
 for(const r of settled){const p=r.snapshot.probability,dist=p?.win!==undefined?{win:p.win,loss:p.loss??1-p.win-p.push,push:p.push}:{win:r.snapshot.side==='Over'?p?.over:p?.under,loss:r.snapshot.side==='Over'?p?.under:p?.over,push:p?.push};
  if(Object.values(dist).some(x=>!Number.isFinite(x)||x<0||x>1)||Math.abs(Object.values(dist).reduce((a,b)=>a+b,0)-1)>1e-6)continue;
  score+=Object.entries(dist).reduce((s,[k,v])=>s+(v-Number(k===r.result.state))**2,0)/2;log-=Math.log(Math.max(1e-15,dist[r.result.state]));n++;
 }
 const units=settled.reduce((s,r)=>s+(r.result.state==='win'?r.snapshot.quote.decimal-1:r.result.state==='loss'?-1:0),0);
 return {predictions:records.length,settled:settled.length,decisions:decisions.length,pushes:settled.length-decisions.length,voids:records.filter(r=>r.result?.state==='void').length,unresolved:records.filter(r=>!['win','loss','push','void'].includes(r.result?.state)).length,independentEvents:new Set(settled.map(r=>r.snapshot.eventId)).size,winRate:decisions.length?decisions.filter(r=>r.result.state==='win').length/decisions.length:null,units,roi:settled.length?units/settled.length:null,scored:n,brier:n?score/n:null,logLoss:n?log/n:null};
}
// Deterministic percentile bootstrap of whole games, retaining all selections per game.
// This describes sampling variability, not model validity or future betting profitability.
export function paperUncertainty(records){
 const grouped=new Map();let excluded=0;
 for(const r of records){
  if(!['win','loss','push'].includes(r.result?.state))continue;
  const s=r.snapshot,id=s?.eventId,price=s?.quote?.decimal;
  if(!['string','number'].includes(typeof id)||String(id).trim()===''||(typeof id==='number'&&!Number.isFinite(id))||!Number.isFinite(price)||price<=1){excluded++;continue}
  const key=String(id);if(!grouped.has(key))grouped.set(key,[]);
  grouped.get(key).push(r.result.state==='win'?price-1:r.result.state==='loss'?-1:0);
 }
 const clusters=[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([,returns])=>({stakes:returns.length,units:returns.sort((a,b)=>a-b).reduce((a,b)=>a+b,0)}));
 const stakes=clusters.reduce((n,g)=>n+g.stakes,0),units=clusters.reduce((n,g)=>n+g.units,0),roi=stakes?units/stakes:null;
 const base={method:'game-cluster percentile bootstrap',confidenceLevel:.95,minimumGames:20,games:clusters.length,settledSelections:stakes,excludedSettlements:excluded,roi,replicates:0,interval:null,status:'insufficient_games',limitations:['At least 20 settled games is a reporting threshold, not evidence of adequate power','Games on different dates or involving the same teams may still be dependent','Intervals omit selection bias, model tuning, feed errors and future regime changes','No automatic model promotion or profitability claim']};
 if(clusters.length<20)return base;
 if(clusters.every(g=>Math.abs(g.units/g.stakes-roi)<1e-12))return {...base,status:'insufficient_variation'};
 let state=0x6e686c31;const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296},values=[];
 for(let b=0;b<2000;b++){let u=0,n=0;for(let i=0;i<clusters.length;i++){const g=clusters[Math.floor(random()*clusters.length)];u+=g.units;n+=g.stakes}values.push(u/n)}
 values.sort((a,b)=>a-b);const quantile=p=>{const x=(values.length-1)*p,i=Math.floor(x);return values[i]+(values[Math.min(i+1,values.length-1)]-values[i])*(x-i)},interval={lower:quantile(.025),upper:quantile(.975)};
 return {...base,replicates:2000,interval,status:interval.lower>0?'positive_interval':interval.upper<0?'negative_interval':'inconclusive'};
}
// Daily settlement batches avoid inventing an order for correlated, simultaneous results.
export function paperRisk(records){
 const days=new Map(),events=new Map();let excluded=0;
 for(const r of records){
  const s=r.snapshot,t=Date.parse(r.result?.gradedAt),state=r.result?.state;
  if(s?.eventId!==undefined)events.set(String(s.eventId),(events.get(String(s.eventId))||0)+1);
  if(!['win','loss','push'].includes(state))continue;
  if(!Number.isFinite(t)||!Number.isFinite(s?.quote?.decimal)||s.quote.decimal<=1){excluded++;continue}
  const date=new Date(t).toISOString().slice(0,10),d=days.get(date)||{date,settled:0,units:0};
  d.settled++;d.units+=state==='win'?s.quote.decimal-1:state==='loss'?-1:0;days.set(date,d);
 }
 let equity=0,peak=0,maxDrawdown=0;
 const daily=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>{equity+=d.units;peak=Math.max(peak,equity);const drawdown=peak-equity;maxDrawdown=Math.max(maxDrawdown,drawdown);return {...d,cumulativeUnits:equity,drawdownUnits:drawdown}});
 return {settlementDays:daily.length,excludedSettlements:excluded,maxDailyDrawdownUnits:daily.length?maxDrawdown:null,worstDayUnits:daily.length?Math.min(...daily.map(d=>d.units)):null,maxSelectionsPerEvent:events.size?Math.max(...events.values()):null,daily,definition:'One unit per settled selection; drawdown at UTC settlement-day closes from a zero starting profit. Corrections restate the as-of history; intraday drawdown and bankroll risk are not measured.'};
}
// Grade history is append-only in the collector; reports select only evidence known by the cutoff.
export function resultAsOf(record,now){
 const start=Date.parse(record.snapshot.startTime);
 if(record.result?.state==='pending')return {state:'pending',reason:'Current settlement unresolved; correction time unavailable'};
 const versions=[...(record.resultHistory||[]),record.result].filter(Boolean);
 const eligible=versions.filter(r=>['win','loss','push','void'].includes(r.state)&&Number.isFinite(Date.parse(r.gradedAt))&&Date.parse(r.gradedAt)>=start&&Date.parse(r.gradedAt)<=now).sort((a,b)=>Date.parse(a.gradedAt)-Date.parse(b.gradedAt));
 return eligible.at(-1)||{state:'pending',reason:'No timestamped settlement available by report cutoff'};
}
export function evaluationWindow(records,{start,days=30,now=Date.now(),observations=[]}={}){
 const begin=Date.parse(start);if(!Number.isFinite(begin)||!Number.isFinite(now)||!Number.isInteger(days)||days<1)throw Error('Explicit evaluation start and positive days required');const end=begin+days*86400000;
 // Only originally qualifying, genuinely pregame captures enter the program.
 const candidates=records.filter(r=>r.snapshot?.candidate===true&&Date.parse(r.snapshot.capturedAt)>=begin&&Date.parse(r.snapshot.capturedAt)<end&&Date.parse(r.snapshot.capturedAt)<=now&&Date.parse(r.snapshot.capturedAt)<Date.parse(r.snapshot.startTime));
 const groupsByIdentity=new Map();
 for(const r of candidates){const s=r.snapshot,key=JSON.stringify([s.eventId,s.market||'player_shots_on_goal',s.playerId??null,s.side,s.line??null,s.modelVersion,s.capturedAt]);if(!groupsByIdentity.has(key))groupsByIdentity.set(key,[]);groupsByIdentity.get(key).push(r)}
 let duplicates=0,conflicts=0,invalidQuotes=0;
 const rows=[];
 for(const group of groupsByIdentity.values()){
  const fingerprints=new Set(group.map(r=>JSON.stringify(r)));
  if(fingerprints.size>1){conflicts+=group.length;continue}
  duplicates+=group.length-1;const r=group[0];if(!Number.isFinite(r.snapshot.quote?.decimal)||r.snapshot.quote.decimal<=1){invalidQuotes++;continue}rows.push({...r,result:resultAsOf(r,now)});
 }
 const values=rows.map(r=>closingValue(r.snapshot,observations,now)).filter(Boolean);
 const clv={matched:values.length,total:rows.length,coverage:rows.length?values.length/rows.length:null,averagePriceRatio:values.length?values.reduce((s,v)=>s+v.priceRatio,0)/values.length:null};
 const groups=key=>Object.fromEntries([...new Set(rows.map(key))].map(k=>[k,paperMetrics(rows.filter(r=>key(r)===k))]));
 return {asOf:new Date(now).toISOString(),audit:{input:candidates.length,duplicateCopiesExcluded:duplicates,conflictingRecordsExcluded:conflicts,invalidQuoteRecordsExcluded:invalidQuotes,unsettledAtCutoff:rows.filter(r=>r.result.state==='pending').length},byCaptureDay:groups(r=>new Date(r.snapshot.capturedAt).toISOString().slice(0,10)),start:new Date(begin).toISOString(),end:new Date(end).toISOString(),complete:now>=end,phase:now<begin?'not_started':now>=end?'ended':'in_progress',mode:'hypothetical flat-stake paper results',uncertainty:paperUncertainty(rows),risk:paperRisk(rows),metrics:paperMetrics(rows),clv,byMarket:groups(r=>r.snapshot.market||'player_shots_on_goal'),byVersion:groups(r=>r.snapshot.modelVersion||'unknown'),limitations:['Window completion describes elapsed time, not collection completeness','Undated or future settlements remain unresolved at the report cutoff','Conflicting duplicate records are excluded, never selected for favorable results','Thirty days does not establish statistical significance','Multiple selections from one game are correlated','Missing closing observations remain unknown; no synthetic CLV','No comparison against sportsbook forecast accuracy without paired complete market snapshots']};
}
