// Edgeboard historical odds evaluator. Research-only, no fetching or betting.
// Input quotes must be timestamped pregame observations from an authorized source.
// Outputs are descriptive paper results, NOT evidence of a profitable betting strategy.
const finite=(x)=>typeof x==='number'&&Number.isFinite(x);
const time=(x)=>typeof x==='string'&&Number.isFinite(Date.parse(x))?Date.parse(x):null;
const round=(x)=>x===null?null:Number(x.toFixed(6));
const pct=(a,b)=>b?round(a/b):null;
export function americanToDecimal(american){
 if(!Number.isInteger(american)||american===0||Math.abs(american)<100||Math.abs(american)>100000)throw Error('Invalid American odds');
 return american>0?1+american/100:1+100/Math.abs(american);
}
export function decimalToImplied(decimal){
 if(!finite(decimal)||decimal<=1||decimal>1001)throw Error('Invalid decimal odds');
 return 1/decimal;
}
export function noVigPair(decimalA,decimalB){
 const a=decimalToImplied(decimalA),b=decimalToImplied(decimalB),total=a+b;
 if(total<.95||total>1.5)throw Error('Implausible paired market overround');
 return {sideA:round(a/total),sideB:round(b/total),overround:round(total-1)};
}
export function expectedValue(probability,decimal){
 if(!finite(probability)||probability<0||probability>1)throw Error('Invalid probability');
 return probability*(decimalToImplied(decimal)**-1-1)-(1-probability);
}
function marketKey(x){return [x.eventId,x.market,x.subjectId??'',x.line??'',x.side].join('|')}
function opponentSide(side){return side==='Over'?'Under':side==='Under'?'Over':side==='Home'?'Away':side==='Away'?'Home':null}
function assertText(x,label){if(typeof x!=='string'||!x.trim()||x.length>100)throw Error('Invalid '+label)}
function assertQuote(q){
 if(!q||typeof q!=='object')throw Error('Invalid quote');
 for(const field of ['eventId','market','side','bookmaker','observedAt','source'])assertText(q[field],field);
 if(q.subjectId!==null&&q.subjectId!==undefined)assertText(q.subjectId,'subjectId');
 if(q.line!==null&&q.line!==undefined&&!finite(q.line))throw Error('Invalid quote line');
 decimalToImplied(q.decimal);
 if(time(q.observedAt)===null)throw Error('Invalid quote time');
}
function assertPrediction(p){
 if(!p||typeof p!=='object')throw Error('Invalid prediction');
 for(const field of ['id','eventId','market','side','startTime','predictedAt'])assertText(p[field],field);
 if(p.subjectId!==null&&p.subjectId!==undefined)assertText(p.subjectId,'subjectId');
 if(p.line!==null&&p.line!==undefined&&!finite(p.line))throw Error('Invalid prediction line');
 if(!finite(p.probability)||p.probability<0||p.probability>1)throw Error('Invalid prediction probability');
 if(time(p.predictedAt)===null||time(p.startTime)===null||time(p.predictedAt)>=time(p.startTime))throw Error('Prediction not before event');
 if(!['win','loss','push','void','pending'].includes(p.result))throw Error('Invalid settlement state');
}
function group(rows,key){
 const groups=new Map();
 for(const row of rows){const k=row[key];if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row)}
 return Object.fromEntries([...groups].sort(([a],[b])=>a.localeCompare(b)).map(([k,rs])=>[k,metrics(rs)]));
}
function metrics(rows){
 const settled=rows.filter(r=>r.result==='win'||r.result==='loss'||r.result==='push');
 const decisions=settled.filter(r=>r.result!=='push');
 const staked=settled.length;
 const profit=settled.reduce((s,r)=>s+(r.result==='win'?r.decimal-1:r.result==='loss'?-1:0),0);
 return {quotes:rows.length,settled:staked,unresolved:rows.length-staked,wins:decisions.filter(r=>r.result==='win').length,
  losses:decisions.filter(r=>r.result==='loss').length,pushes:settled.filter(r=>r.result==='push').length,
  winRate:pct(decisions.filter(r=>r.result==='win').length,decisions.length),
  meanEstimatedEV:rows.length?round(rows.reduce((s,r)=>s+r.estimatedEV,0)/rows.length):null,
  paperProfitUnits:staked?round(profit):null,paperROI:pct(profit,staked),
  meanPredictedProbability:rows.length?round(rows.reduce((s,r)=>s+r.probability,0)/rows.length):null,
  meanImpliedProbability:rows.length?round(rows.reduce((s,r)=>s+r.implied,0)/rows.length):null};
}
/**
 * @param {{predictions:object[],quotes:object[],mode:'synthetic'|'licensed-historical',licenseReference?:string,
 * selectionPolicy?:'best-available'|'bookmaker-fixed',bookmaker?:string}} input
 */
export function evaluateHistoricalOdds(input){
 if(!input||!['synthetic','licensed-historical'].includes(input.mode))throw Error('Explicit provenance mode required');
 if(input.mode==='licensed-historical')assertText(input.licenseReference,'licenseReference');
 if(!Array.isArray(input.predictions)||!Array.isArray(input.quotes)||input.predictions.length>50000||input.quotes.length>200000)throw Error('Invalid dataset');
 const selectionPolicy=input.selectionPolicy??'best-available';
 if(!['best-available','bookmaker-fixed'].includes(selectionPolicy))throw Error('Invalid selection policy');
 if(selectionPolicy==='bookmaker-fixed')assertText(input.bookmaker,'bookmaker');
 input.quotes.forEach(assertQuote);input.predictions.forEach(assertPrediction);
 const ids=new Set();
 for(const p of input.predictions){if(ids.has(p.id))throw Error('Duplicate prediction id');ids.add(p.id)}
 const quoteGroups=new Map();
 for(const q of input.quotes){const key=marketKey(q);if(!quoteGroups.has(key))quoteGroups.set(key,[]);quoteGroups.get(key).push(q)}
 const accepted=[],rejected={noQuote:0,stale:0,conflicting:0,invalidSource:0},MAX_AGE=60*60*1000;
 for(const p of input.predictions){
  const quotes=quoteGroups.get(marketKey(p))??[];
  const candidates=quotes.filter(q=>
   q.source===(input.mode==='synthetic'?'synthetic-fixture':input.licenseReference)
   &&(selectionPolicy!=='bookmaker-fixed'||q.bookmaker===input.bookmaker)
   &&time(q.observedAt)<=time(p.predictedAt)
   &&time(q.observedAt)<time(p.startTime)
   &&time(p.predictedAt)-time(q.observedAt)<=MAX_AGE);
  if(!candidates.length){if(quotes.length&&quotes.some(q=>q.source!==(input.mode==='synthetic'?'synthetic-fixture':input.licenseReference)))rejected.invalidSource++;else if(quotes.length)rejected.stale++;else rejected.noQuote++;continue}
  // One quote per bookmaker: latest observed quote before the prediction.
  const byBook=new Map();
  for(const q of candidates){const prev=byBook.get(q.bookmaker);
   if(!prev||time(q.observedAt)>time(prev.observedAt))byBook.set(q.bookmaker,q);
   else if(time(q.observedAt)===time(prev.observedAt)&&q.decimal!==prev.decimal)byBook.set(q.bookmaker,{...q,conflict:true});
  }
  const options=[...byBook.values()].filter(q=>!q.conflict);
  if(!options.length){rejected.conflicting++;continue}
  options.sort((a,b)=>b.decimal-a.decimal||a.bookmaker.localeCompare(b.bookmaker));
  const chosen=options[0];
  const opposite=opponentSide(p.side);
  const counterpart=(quoteGroups.get([p.eventId,p.market,p.subjectId??'',p.line??'',opposite].join('|'))??[])
   .filter(q=>opposite&&q.bookmaker===chosen.bookmaker&&q.source===chosen.source
    &&time(q.observedAt)<=time(p.predictedAt)&&time(p.predictedAt)-time(q.observedAt)<=MAX_AGE)
   .sort((a,b)=>time(b.observedAt)-time(a.observedAt));
  const noVig=counterpart.length?noVigPair(chosen.decimal,counterpart[0].decimal):null;
  accepted.push({id:p.id,market:p.market,bookmaker:chosen.bookmaker,eventId:p.eventId,subjectId:p.subjectId??null,
   line:p.line??null,side:p.side,probability:p.probability,decimal:chosen.decimal,implied:round(decimalToImplied(chosen.decimal)),
   noVigImplied:noVig?.sideA??null,overround:noVig?.overround??null,estimatedEV:round(expectedValue(p.probability,chosen.decimal)),
   result:p.result,predictedAt:p.predictedAt,observedAt:chosen.observedAt});
 }
 return {mode:input.mode,licenseReference:input.mode==='licensed-historical'?input.licenseReference:null,
  selectionPolicy,oddsFreshnessMinutes:60,quotesAreHistorical:input.mode==='licensed-historical',
  dataIsSynthetic:input.mode==='synthetic',notRealizedProfit:input.mode==='synthetic',
  counts:{predictions:input.predictions.length,quoteRows:input.quotes.length,matched:accepted.length,rejected},
  summary:metrics(accepted),byMarket:group(accepted,'market'),byBookmaker:group(accepted,'bookmaker'),
  records:accepted,
  caveats:['Synthetic mode is arithmetic testing only: ROI and EV are illustrative, not evidence.',
   'Historical prices require documented license and authentic timestamped pregame quotes; no backfilled prices treated as live.',
   'Selection is based on quoted odds available at prediction timestamp, never closing odds or later prices.',
   'One unit per settled pick, push returns stake; void/pending excluded from paper ROI.',
   'No model calibration, selection-bias correction, vig-adjusted predictive probability, CLV, or profitability inference.',
   'Paired no-vig reference is informational and only for two-outcome markets; counterpart must be same book, line and market.',
   'No automated wager placement or live collection.']};
}
