// Offline pooled calibration only. Fixed grid and chronology; no production promotion.
import {calibrationRobustness} from '../game-calibration.js';
const clamp=p=>Math.max(1e-6,Math.min(1-1e-6,p));
const loss=(p,y)=>-y*Math.log(clamp(p))-(1-y)*Math.log(1-clamp(p));
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
const date=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const transform=(p,slope,bias)=>1/(1+Math.exp(-(slope*Math.log(clamp(p)/(1-clamp(p)))+bias)));
export function calibrateShots(input,{minTraining=500,window=5000,minDates=10,includeTests=false}={}){
 if(!Array.isArray(input)||!Number.isInteger(minTraining)||minTraining<20||!Number.isInteger(window)||window<minTraining||!Number.isInteger(minDates)||minDates<2)throw Error('Valid calibration limits required');
 const groups=new Map(),audit={invalid:0,duplicateCopies:0,conflictingIds:0,warmup:0};
 for(const r of input){if(!r||!/^\d{7}$/.test(r.playerId||'')||!date(r.date)||!date(r.trainingEnd)||r.trainingEnd>=r.date||![r.predicted,r.baselinePredicted].every(p=>Number.isFinite(p)&&p>0&&p<1)||![0,1].includes(r.outcome)){audit.invalid++;continue}const row={id:r.playerId+':'+r.date,date:r.date,trainingEnd:r.trainingEnd,probability:r.predicted,baselineProbability:r.baselinePredicted,outcome:r.outcome};if(!groups.has(row.id))groups.set(row.id,[]);groups.get(row.id).push(row)}
 const rows=[];for(const copies of groups.values()){if(new Set(copies.map(r=>JSON.stringify(r))).size>1){audit.conflictingIds++;continue}audit.duplicateCopies+=copies.length-1;rows.push(copies[0])}
 rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));const days=new Map();for(const r of rows){if(!days.has(r.date))days.set(r.date,[]);days.get(r.date).push(r)}
 let history=[];const tests=[];
 for(const [day,targets] of days){
  const prior=history.slice(-window);if(prior.length<minTraining||new Set(prior.map(r=>r.date)).size<minDates){audit.warmup+=targets.length;history.push(...targets);continue}
  let fit={slope:1,bias:0,score:avg(prior.map(r=>loss(r.probability,r.outcome)))};
  // Identity wins numerical ties. Fit once per date before observing any targets that date.
  for(const slope of [.5,.75,1,1.25,1.5])for(const bias of [-.3,-.15,0,.15,.3]){const score=avg(prior.map(r=>loss(transform(r.probability,slope,bias),r.outcome)));if(score<fit.score-1e-12)fit={slope,bias,score}}
  for(const target of targets)tests.push({...target,calibrated:transform(target.probability,fit.slope,fit.bias),slope:fit.slope,bias:fit.bias,calibrationTrainingEnd:prior.at(-1).date,calibrationSample:prior.length});
  history.push(...targets);
 }
 const metrics=(rows,key)=>({n:rows.length,brier:avg(rows.map(r=>(r[key]-r.outcome)**2)),logLoss:avg(rows.map(r=>loss(r[key],r.outcome)))});
 const compare=rows=>({model:metrics(rows,'probability'),baseline:metrics(rows,'baselineProbability'),challenger:metrics(rows,'calibrated')});
 const bins=key=>Array.from({length:5},(_,i)=>{const bin=tests.filter(r=>Math.min(4,Math.floor(r[key]*5))===i);return {lower:i/5,upper:(i+1)/5,n:bin.length,predicted:avg(bin.map(r=>r[key])),observed:avg(bin.map(r=>r.outcome))}});
 return {version:'shots-calibration-research-v1',researchOnly:true,promoted:false,settings:{minTraining,window,minDates,objective:'prior-date log loss',fitFrequency:'daily'},audit,...compare(tests),firstTest:tests[0]?.date||null,lastTest:tests.at(-1)?.date||null,chronologyValid:tests.every(r=>r.trainingEnd<r.date&&r.calibrationTrainingEnd<r.date),robustnessAgainstModel:calibrationRobustness(tests),robustnessAgainstBaseline:calibrationRobustness(tests.map(r=>({...r,probability:r.baselineProbability}))),byMonth:[...new Set(tests.map(r=>r.date.slice(0,7)))].map(month=>({month,...compare(tests.filter(r=>r.date.startsWith(month)))})),calibration:{model:bins('probability'),baseline:bins('baselineProbability'),challenger:bins('calibrated')},...(includeTests?{tests}:{}),limitations:['Same reused retrospective development archive; not a new untouched holdout','Pooled player calibration; repeated players and game dates are correlated','Bootstrap resamples dates and cannot account for all serial dependence or archive tuning','All comparisons use identical post-warmup forecasts; not directly comparable with the earlier full sample','Prior-date availability assumed; historical publication/revision times unverified','Conditional on eventual player appearances, not verified pregame roster selection','No historical sportsbook prices, ROI, live trial or production model promotion']};
}
