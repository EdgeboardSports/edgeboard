// Experimental challengers. Never promoted automatically from an in-sample fit.
import {probabilities,minutes} from './shots-model.js';
export const COUNT_VERSION='count-challenger-v1';
const avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function history(games,stat,before){
 const seen=new Set();return games.filter(g=>{
  const date=g.gameDate||g.date,key=g.gameId??date;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!(date<before)||seen.has(key)||!Number.isInteger(g[stat])||g[stat]<0)return false;
  seen.add(key);return true;
 }).sort((a,b)=>(a.gameDate||a.date).localeCompare(b.gameDate||b.date));
}
export function fitCount(games,{stat='shots',before,distribution='negative-binomial'}={}){
 if(!['shots','points'].includes(stat)||!['poisson','negative-binomial'].includes(distribution)||!/^\d{4}-\d{2}-\d{2}$/.test(before||''))throw Error('Explicit pregame cutoff, statistic and distribution required');
 const rows=history(games,stat,before).slice(-82);if(rows.length<20)return null;
 const values=rows.map(g=>g[stat]),base=avg(values),last5=avg(values.slice(-5)),last10=avg(values.slice(-10));
 // Recent estimates shrink toward the longer record. Nested windows are not independent samples.
 const recentWeight=10/(10+30),rate=base*(1-recentWeight)+last10*recentWeight;
 const timed=rows.map(g=>({count:g[stat],toi:minutes(g.toi)})).filter(g=>g.toi!==null),recentTimed=rows.slice(-5).map(g=>minutes(g.toi)).filter(finite);
 let mean=rate,expectedMinutes=null;
 if(timed.length>=20&&recentTimed.length===5){
  const baseline=avg(timed.map(g=>g.toi)),recent=avg(recentTimed);
  expectedMinutes=(baseline*20+recent*5)/25;
  // Normalize counts by exposure before changing expected exposure (avoids counting TOI growth twice).
  const perMinute=timed.reduce((s,g)=>s+g.count,0)/timed.reduce((s,g)=>s+g.toi,0);
  mean=perMinute*expectedMinutes;
 }
 // Points use their own production history and dispersion, never a shots conversion.
 const variance=values.reduce((s,x)=>s+(x-base)**2,0)/(values.length-1);
 const alpha=distribution==='poisson'||base===0?0:Math.max(0,(variance-base)/(base*base))*rows.length/(rows.length+40);
 return {version:COUNT_VERSION,stat,distribution,mean:Math.max(.001,mean),alpha,sample:rows.length,base,last5,last10,expectedMinutes,trainingEnd:rows.at(-1).gameDate||rows.at(-1).date,missing:['shot attempts','expected goals/assists','confirmed lines','power-play assignments','goalie quality'],status:'experimental'};
}
export function compareCounts(games,{stat='shots',line,before}={}){
 if(!finite(line)||line<0)throw Error('Valid market line required');
 const rows=history(games,stat,before),tests=[];
 for(let i=20;i<rows.length;i++){
  const target=rows[i],date=target.gameDate||target.date,train=rows.slice(0,i),actual=target[stat]>line?'over':target[stat]<line?'under':'push',scores={};
  for(const distribution of ['poisson','negative-binomial']){
   const fit=fitCount(train,{stat,before:date,distribution});if(!fit)continue;
   const p=probabilities(fit.mean,fit.alpha,line);
   scores[distribution]={brier:['over','under','push'].reduce((s,k)=>s+(p[k]-Number(actual===k))**2,0)/2,logLoss:-Math.log(Math.max(1e-15,p[actual])),probability:p,trainingEnd:fit.trainingEnd};
  }
  if(Object.keys(scores).length===2)tests.push({date,actual,scores});
 }
 const summary=Object.fromEntries(['poisson','negative-binomial'].map(d=>[d,{n:tests.length,brier:tests.length?avg(tests.map(t=>t.scores[d].brier)):null,logLoss:tests.length?avg(tests.map(t=>t.scores[d].logLoss)):null}]));
 return {version:COUNT_VERSION,stat,line,tests,summary,promoted:false,note:'Rolling origin evaluation; overlapping player games are not independent evidence. No automatic promotion.'};
}
