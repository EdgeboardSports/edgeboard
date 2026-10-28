// Offline binary-moneyline calibration experiment. Never promotes or changes production models.
const clamp=p=>Math.max(1e-6,Math.min(1-1e-6,p));
const logit=p=>Math.log(clamp(p)/(1-clamp(p)));
const calibrated=(p,slope,bias)=>1/(1+Math.exp(-(slope*logit(p)+bias)));
const loss=(p,y)=>-y*Math.log(clamp(p))-(1-y)*Math.log(1-clamp(p));
const average=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function walkForwardCalibration(input,{minTraining=200,window=500,maxTests=200}={}){
 if(!Number.isInteger(minTraining)||minTraining<20||!Number.isInteger(window)||window<minTraining||!Number.isInteger(maxTests)||maxTests<1)throw Error('Valid calibration sample limits required');
 const audit={invalid:0,duplicateCopies:0,conflictingIds:0,insufficientTraining:0};
 const groups=new Map();
 for(const row of input){if(!row||!String(row.id||'')||!validDate(row.date)||!validDate(row.trainingEnd)||row.trainingEnd>=row.date||!Number.isFinite(row.probability)||row.probability<=0||row.probability>=1||![0,1].includes(row.outcome)){audit.invalid++;continue}const key=String(row.id);if(!groups.has(key))groups.set(key,[]);groups.get(key).push({id:key,date:row.date,trainingEnd:row.trainingEnd,probability:row.probability,outcome:row.outcome})}
 const rows=[];for(const copies of groups.values()){if(new Set(copies.map(r=>JSON.stringify(r))).size>1){audit.conflictingIds++;continue}audit.duplicateCopies+=copies.length-1;rows.push(copies[0])}
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
 const tests=[];
 for(const target of rows){
  const prior=rows.filter(r=>r.date<target.date).slice(-window);
  if(prior.length<minTraining){audit.insufficientTraining++;continue}
  // Grid fixed before evaluation; identity wins ties. No target outcome participates in fitting.
  let fitted={slope:1,bias:0,loss:average(prior.map(r=>loss(r.probability,r.outcome)))};
  for(const slope of [.5,.75,1,1.25,1.5,2])for(const bias of [-.3,-.15,0,.15,.3]){
   const score=average(prior.map(r=>loss(calibrated(r.probability,slope,bias),r.outcome)));
   if(score<fitted.loss-1e-12)fitted={slope,bias,loss:score};
  }
  tests.push({...target,calibrated:calibrated(target.probability,fitted.slope,fitted.bias),slope:fitted.slope,bias:fitted.bias,calibrationTrainingEnd:prior.at(-1).date,calibrationSample:prior.length});
 }
 const paired=tests.slice(-maxTests);
 const metrics=key=>({n:paired.length,brier:average(paired.map(r=>(r[key]-r.outcome)**2)),logLoss:average(paired.map(r=>loss(r[key],r.outcome))),calibration:Array.from({length:5},(_,i)=>{const bin=paired.filter(r=>Math.min(4,Math.floor(r[key]*5))===i);return {lower:i/5,upper:(i+1)/5,n:bin.length,predicted:average(bin.map(r=>r[key])),observed:average(bin.map(r=>r.outcome))}})});
 const base=metrics('probability'),challenger=metrics('calibrated');
 return {version:'moneyline-calibration-research-v1',experimental:true,promoted:false,audit,base,challenger,pairedBrierImprovement:paired.length?base.brier-challenger.brier:null,pairedLogLossImprovement:paired.length?base.logLoss-challenger.logLoss:null,tests:paired,limitations:['Saved final outcomes assumed available by the next game date','Same-day outcomes excluded from calibration fitting','Fixed research grid; no production model promotion','No sportsbook prices, ROI or profitability inference','Repeated evaluation of this archive is development evidence, not a new untouched holdout']};
}
