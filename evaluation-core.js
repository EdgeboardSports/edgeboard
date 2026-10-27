// Provider-neutral research metrics. No wagering or data acquisition occurs here.
export function closingValue(snapshot,observations){
 const start=Date.parse(snapshot.startTime),capture=Date.parse(snapshot.capturedAt),q=snapshot.quote;
 if(!Number.isFinite(start)||!Number.isFinite(capture)||capture>=start||!Number.isFinite(q?.decimal)||q.decimal<=1)return null;
 const same=o=>o.eventId===snapshot.eventId&&o.market===(snapshot.market||'player_shots_on_goal')&&o.side===snapshot.side&&(o.playerId??null)===(snapshot.playerId??null)&&(o.line??null)===(snapshot.line??null)&&o.bookmaker===q.bookmaker;
 const eligible=observations.filter(o=>same(o)&&Number.isFinite(o.decimal)&&o.decimal>1&&Date.parse(o.observedAt)>=capture&&Date.parse(o.observedAt)<start&&Date.parse(o.quoteAt)<=Date.parse(o.observedAt)&&Date.parse(o.quoteAt)>=Date.parse(o.observedAt)-15*60000).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
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
export function evaluationWindow(records,{start,days=30,now=Date.now(),observations=[]}={}){
 const begin=Date.parse(start);if(!Number.isFinite(begin)||!Number.isInteger(days)||days<1)throw Error('Explicit evaluation start and positive days required');const end=begin+days*86400000;
 // Only originally qualifying, genuinely pregame captures enter the program.
 const rows=records.filter(r=>r.snapshot?.candidate===true&&Date.parse(r.snapshot.capturedAt)>=begin&&Date.parse(r.snapshot.capturedAt)<end&&Date.parse(r.snapshot.capturedAt)<=now&&Date.parse(r.snapshot.capturedAt)<Date.parse(r.snapshot.startTime));
 const values=rows.map(r=>closingValue(r.snapshot,observations)).filter(Boolean);
 const clv={matched:values.length,total:rows.length,averagePriceRatio:values.length?values.reduce((s,v)=>s+v.priceRatio,0)/values.length:null};
 const groups=key=>Object.fromEntries([...new Set(rows.map(key))].map(k=>[k,paperMetrics(rows.filter(r=>key(r)===k))]));
 return {start:new Date(begin).toISOString(),end:new Date(end).toISOString(),complete:now>=end,mode:'hypothetical flat-stake paper results',metrics:paperMetrics(rows),clv,byMarket:groups(r=>r.snapshot.market||'player_shots_on_goal'),byVersion:groups(r=>r.snapshot.modelVersion||'unknown'),limitations:['Thirty days does not establish statistical significance','Multiple selections from one game are correlated','Missing closing observations remain unknown; no synthetic CLV','No comparison against sportsbook forecast accuracy without paired complete market snapshots']};
}
