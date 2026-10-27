// Provider-neutral research metrics. No wagering or data acquisition occurs here.
export function closingValue(snapshot,observations,now=Date.now()){
 const start=Date.parse(snapshot.startTime),capture=Date.parse(snapshot.capturedAt),q=snapshot.quote;
 if(!Number.isFinite(start)||!Number.isFinite(capture)||capture>=start||now<start||!Number.isFinite(q?.decimal)||q.decimal<=1)return null;
 const same=o=>o.eventId===snapshot.eventId&&o.market===(snapshot.market||'player_shots_on_goal')&&o.side===snapshot.side&&(o.playerId??null)===(snapshot.playerId??null)&&(o.line??null)===(snapshot.line??null)&&o.bookmaker===q.bookmaker;
 const eligible=observations.filter(o=>same(o)&&Number.isFinite(o.decimal)&&o.decimal>1&&Date.parse(o.observedAt)<=now&&Date.parse(o.observedAt)>=capture&&Date.parse(o.observedAt)<start&&Date.parse(o.quoteAt)<=Date.parse(o.observedAt)&&Date.parse(o.quoteAt)>=Date.parse(o.observedAt)-15*60000).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const last=eligible.at(-1);if(!last||start-Date.parse(last.observedAt)>15*60000)return null;
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
 return {asOf:new Date(now).toISOString(),audit:{input:candidates.length,duplicateCopiesExcluded:duplicates,conflictingRecordsExcluded:conflicts,invalidQuoteRecordsExcluded:invalidQuotes,unsettledAtCutoff:rows.filter(r=>r.result.state==='pending').length},byCaptureDay:groups(r=>new Date(r.snapshot.capturedAt).toISOString().slice(0,10)),start:new Date(begin).toISOString(),end:new Date(end).toISOString(),complete:now>=end,phase:now<begin?'not_started':now>=end?'ended':'in_progress',mode:'hypothetical flat-stake paper results',metrics:paperMetrics(rows),clv,byMarket:groups(r=>r.snapshot.market||'player_shots_on_goal'),byVersion:groups(r=>r.snapshot.modelVersion||'unknown'),limitations:['Window completion describes elapsed time, not collection completeness','Undated or future settlements remain unresolved at the report cutoff','Conflicting duplicate records are excluded, never selected for favorable results','Thirty days does not establish statistical significance','Multiple selections from one game are correlated','Missing closing observations remain unknown; no synthetic CLV','No comparison against sportsbook forecast accuracy without paired complete market snapshots']};
}
