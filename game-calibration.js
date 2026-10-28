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
 return {version:'moneyline-calibration-research-v1',experimental:true,promoted:false,audit,base,challenger,pairedBrierImprovement:paired.length?base.brier-challenger.brier:null,pairedLogLossImprovement:paired.length?base.logLoss-challenger.logLoss:null,tests:paired,robustness:calibrationRobustness(paired),limitations:['Saved final outcomes assumed available by the next game date','Same-day outcomes excluded from calibration fitting','Fixed research grid; no production model promotion','No sportsbook prices, ROI or profitability inference','Repeated evaluation of this archive is development evidence, not a new untouched holdout']};
}

// Resample whole game dates so games on the same slate stay together.
// This measures archive sampling uncertainty, not future profitability.
export function calibrationRobustness(tests,{replicates=2000,seed=20261028}={}){
 if(!Number.isInteger(replicates)||replicates<100||replicates>10000||!Number.isInteger(seed))throw Error('Valid bootstrap settings required');
 const dates=new Map(),months=new Map();
 for(const r of tests){
  if(!validDate(r.date)||![r.probability,r.calibrated].every(p=>Number.isFinite(p)&&p>0&&p<1)||![0,1].includes(r.outcome))throw Error('Invalid paired forecast');
  const delta={brier:(r.probability-r.outcome)**2-(r.calibrated-r.outcome)**2,logLoss:loss(r.probability,r.outcome)-loss(r.calibrated,r.outcome)};
  for(const [map,key] of [[dates,r.date],[months,r.date.slice(0,7)]]){if(!map.has(key))map.set(key,[]);map.get(key).push(delta)}
 }
 const summarize=rows=>({n:rows.length,brierImprovement:average(rows.map(r=>r.brier)),logLossImprovement:average(rows.map(r=>r.logLoss))});
 for(const map of [dates,months])for(const rows of map.values())rows.sort((a,b)=>a.brier-b.brier||a.logLoss-b.logLoss);
 const clusters=[...dates.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,rows])=>rows);
 let state=seed>>>0;const random=()=>{state=(Math.imul(1664525,state)+1013904223)>>>0;return state/4294967296};
 const samples={brier:[],logLoss:[]};
 if(clusters.length>=20)for(let i=0;i<replicates;i++){
  let n=0,brier=0,logLoss=0;
  for(let j=0;j<clusters.length;j++)for(const row of clusters[Math.floor(random()*clusters.length)]){n++;brier+=row.brier;logLoss+=row.logLoss}
  samples.brier.push(brier/n);samples.logLoss.push(logLoss/n);
 }
 const interval=values=>{if(!values.length)return null;values.sort((a,b)=>a-b);return {lower:values[Math.floor(.025*(values.length-1))],upper:values[Math.ceil(.975*(values.length-1))]}};
 return {method:'paired game-date cluster bootstrap percentile',seed,replicates:clusters.length>=20?replicates:0,distinctDates:clusters.length,minimumDates:20,brierImprovement95:interval(samples.brier),logLossImprovement95:interval(samples.logLoss),monthly:[...months.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([month,rows])=>({month,...summarize(rows)})),interpretation:'Positive improvement favors calibration. Intervals crossing zero are inconclusive. Archive development evidence only; no automatic promotion.'};
}
