// Shots v1: fixed exploratory model. Do not tune against the displayed holdout.
export const VERSION='shots-v1';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),avg=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function minutes(toi){if(typeof toi!=='string'||!/^\d+:\d{2}$/.test(toi))return null;const [m,s]=toi.split(':').map(Number);return s<60&&m+s/60>0?m+s/60:null}
export function validGames(games){const seen=new Set();return games.filter(g=>{
 const date=g.gameDate||g.date,key=g.gameId||date;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||g.shots===null||g.shots===undefined||g.shots===''||!Number.isInteger(Number(g.shots))||Number(g.shots)<0||seen.has(key))return false;
 seen.add(key);return true;
}).sort((a,b)=>(a.gameDate||a.date).localeCompare(b.gameDate||b.date))}
export function fit(games,context={}){
 const sample=validGames(games).slice(-40);if(sample.length<20)return null;
 const values=sample.map(g=>Number(g.shots)),base=avg(values),recent=avg(values.slice(-10));let mean=.5*base+.5*recent;
 const variance=values.reduce((sum,n)=>sum+(n-base)**2,0)/Math.max(1,values.length-1);
 const adjust=(list,prior,cap)=>{if(!list.length||!base)return 1;const ratio=avg(list.map(g=>Number(g.shots)))/base;return clamp(1+(ratio-1)*list.length/(list.length+prior),1-cap,1+cap)};
 const venue=adjust(sample.filter(g=>context.venue&&g.homeRoadFlag===context.venue),20,.10);
 const opponent=adjust(sample.filter(g=>context.opponent&&g.opponentAbbrev===context.opponent),40,.10);
 const timed=sample.map(g=>minutes(g.toi)).filter(v=>v!==null),recentTimed=sample.slice(-5).map(g=>minutes(g.toi)).filter(v=>v!==null);
 const iceTime=timed.length>=20&&recentTimed.length>=3?clamp(avg(recentTimed)/avg(timed),.85,1.15):1;
 mean=clamp(mean*venue*opponent*iceTime,.01,15);
 return {mean,alpha:base?clamp(.5*(variance-base)/(base*base),0,1):0,sample:sample.length,base,recent,venue,opponent,iceTime,usesIceTime:timed.length>=20&&recentTimed.length>=3};
}
export function probabilities(mean,alpha,line){
 if(!Number.isFinite(mean)||mean<=0||!Number.isFinite(alpha)||alpha<0||!Number.isFinite(line)||line<0)throw Error('Invalid count distribution');
 // NB2 variance = mean + alpha*mean^2; alpha=0 is Poisson.
 const r=alpha>1e-8?1/alpha:null,p=r?r/(r+mean):null;
 let mass=r?Math.exp(r*Math.log(p)):Math.exp(-mean),under=0,push=0;
 for(let k=0;k<=Math.floor(line);k++){if(k<line)under+=mass;else push=mass;mass*=r?((k+r)/(k+1))*(1-p):mean/(k+1)}
 const over=clamp(1-under-push,0,1);return {over,under:clamp(under,0,1),push:clamp(push,0,1)};
}
function empirical(sample,line){const n=sample.length,counts={over:.5,under:.5,push:Number.isInteger(line)?.5:0};
 for(const g of sample){const x=Number(g.shots);counts[x>line?'over':x<line?'under':'push']++}
 const total=n+1+(Number.isInteger(line)?.5:0);return Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v/total]));
}
export function backtest(games,line){
 const ordered=validGames(games),start=Math.max(20,ordered.length-40),tests=[],bins=Array.from({length:5},()=>({n:0,predicted:0,observed:0}));
 for(let i=start;i<ordered.length;i++){
  const target=ordered[i],day=target.gameDate||target.date,train=ordered.slice(0,i).filter(g=>(g.gameDate||g.date)<day),model=fit(train,{venue:target.homeRoadFlag,opponent:target.opponentAbbrev});if(!model)continue;
  const probability=probabilities(model.mean,model.alpha,line),baseline=empirical(train.slice(-40),line),shot=Number(target.shots),outcome=shot>line?'over':shot<line?'under':'push';
  const loss=p=>['over','under','push'].reduce((s,k)=>s+(p[k]-(outcome===k?1:0))**2,0)/2;
  tests.push({date:day,predicted:probability.over,outcome:Number(outcome==='over'),loss:loss(probability),baseline:loss(baseline),trainingEnd:train.at(-1)?.gameDate||train.at(-1)?.date});
  const bin=bins[Math.min(4,Math.floor(probability.over*5))];bin.n++;bin.predicted+=probability.over;bin.observed+=Number(outcome==='over');
 }
 const n=tests.length;return {games:n,brier:n?avg(tests.map(t=>t.loss)):null,baseline:n?avg(tests.map(t=>t.baseline)):null,bias:n?avg(tests.map(t=>t.predicted-t.outcome)):null,bins:bins.map(b=>({n:b.n,predicted:b.n?b.predicted/b.n:null,observed:b.n?b.observed/b.n:null})),tests};
}
export function quoteValue(probability,side,decimal){
 if(!['Over','Under'].includes(side)||!Number.isFinite(decimal)||decimal<=1)throw Error('Invalid quote');
 const win=side==='Over'?probability.over:probability.under,lose=side==='Over'?probability.under:probability.over;
 const settled=win+lose;return {win,push:probability.push,conditional:settled?win/settled:null,breakEven:1/decimal,edge:settled?win/settled-1/decimal:null,ev:win*(decimal-1)-lose};
}
export function evaluate(games,line,context={}){
 const model=fit(games,context);if(!model)return null;
 const prediction=probabilities(model.mean,model.alpha,line),test=backtest(games,line);
 return {model,prediction,test,low:probabilities(model.mean*.85,model.alpha,line),high:probabilities(model.mean*1.15,model.alpha,line)};
}
