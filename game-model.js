import {confirmedGoalies,gameDayEvidence} from './game-day.js';
export const GAME_VERSION='goals-v1';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
export function normalizeGame(g){
 if(g.gameType!==2||!['OFF','FINAL'].includes(g.gameState))return null;
 const h=Number(g.homeTeam?.score),a=Number(g.awayTeam?.score),type=g.gameOutcome?.lastPeriodType||g.periodDescriptor?.periodType;
 if(g.homeTeam?.score==null||g.awayTeam?.score==null||!Number.isInteger(h)||!Number.isInteger(a)||h<0||a<0||h===a||!['REG','OT','SO'].includes(type))return null;
 if(type!=='REG'&&Math.abs(h-a)!==1)return null;
 const reg=type==='REG'?[h,a]:[Math.min(h,a),Math.min(h,a)];
 return {id:g.id,season:g.season,date:g.gameDate,startTime:g.startTimeUTC,home:g.homeTeam.abbrev,away:g.awayTeam.abbrev,homeGoals:reg[0],awayGoals:reg[1],finalHome:h,finalAway:a,endType:type};
}
function rates(games,team,venue){
 const rows=games.filter(g=>g.home===team||g.away===team).sort((a,b)=>a.date.localeCompare(b.date)).slice(-40).map(g=>({venue:g.home===team?'H':'R',gf:g.home===team?g.homeGoals:g.awayGoals,ga:g.home===team?g.awayGoals:g.homeGoals}));
 if(rows.length<20)return null;
 const rate=key=>{const values=rows.map(g=>g[key]),raw=.5*mean(values)+.5*mean(values.slice(-10)),base=(raw*rows.length+2.8*10)/(rows.length+10),same=rows.filter(g=>g.venue===venue),adjust=same.length&&raw?clamp(1+(mean(same.map(g=>g[key]))/raw-1)*same.length/(same.length+20),.9,1.1):1;return base*adjust};
 return {attack:rate('gf'),defense:rate('ga'),games:rows.length,trainingEnd:rows.length?games.filter(g=>g.home===team||g.away===team).map(g=>g.date).sort().at(-1):null};
}
export function fitGame(games,home,away,before){
 const prior=games.filter(g=>g.date<before),h=rates(prior,home,'H'),a=rates(prior,away,'R');if(!h||!a)return null;
 return {home:clamp(Math.sqrt(h.attack*a.defense),.25,6),away:clamp(Math.sqrt(a.attack*h.defense),.25,6),homeSample:h.games,awaySample:a.games,trainingEnd:[h.trainingEnd,a.trainingEnd].sort().at(-1),overtimeHome:.5};
}
function poisson(mu){const p=[Math.exp(-mu)];for(let k=1;k<=30;k++)p.push(p[k-1]*mu/k);const sum=p.reduce((a,b)=>a+b,0);return p.map(x=>x/sum)}
export function marketProbabilities(model,market,side,point=null){
 if(!model||!Number.isFinite(model.home)||!Number.isFinite(model.away)||model.home<=0||model.away<=0)throw Error('Invalid goal model');
 if(!['h2h','spreads','h2h_3_way','totals'].includes(market)||!(market==='totals'?['Over','Under']:['Home','Away','Draw']).includes(side)||(side==='Draw'&&market!=='h2h_3_way'))throw Error('Invalid market/selection');
 if(['spreads','totals'].includes(market)&&(!Number.isFinite(point)||(market==='totals'&&point<0)))throw Error('Puck line required');
 const hp=poisson(model.home),ap=poisson(model.away);let win=0,push=0,loss=0;const outcomes={home:0,draw:0,away:0};
 const settle=(margin,p,total)=>{let value;if(market==='totals')value=side==='Over'?total-point:point-total;else if(market==='h2h')value=side==='Home'?margin:-margin;else if(market==='spreads')value=(side==='Home'?margin:-margin)+point;else value=side==='Draw'?(margin===0?1:-1):side==='Home'?(margin>0?1:-1):(margin<0?1:-1);if(value>0)win+=p;else if(value===0)push+=p;else loss+=p};
 for(let h=0;h<hp.length;h++)for(let a=0;a<ap.length;a++){const p=hp[h]*ap[a],margin=h-a;outcomes[margin>0?'home':margin<0?'away':'draw']+=p;if(market!=='h2h_3_way'&&margin===0){settle(1,p*model.overtimeHome,h+a+1);settle(-1,p*(1-model.overtimeHome),h+a+1)}else settle(margin,p,h+a)}
 return {win,push,loss,regulation:outcomes};
}
export function gameValue(probability,decimal){if(!Number.isFinite(decimal)||decimal<=1)throw Error('Invalid decimal odds');const settled=probability.win+probability.loss;return {ev:probability.win*(decimal-1)-probability.loss,conditional:settled?probability.win/settled:null,breakEven:1/decimal,push:probability.push}}
export function gradeGame(snapshot,g){
 if(!g||!['OFF','FINAL'].includes(g.gameState))return {state:'pending'};
 const h=Number(g.homeTeam?.score),a=Number(g.awayTeam?.score);
 if(g.homeTeam?.score==null||g.awayTeam?.score==null||!Number.isInteger(h)||!Number.isInteger(a)||h===a)return {state:'pending',reason:'Waiting for official final score'};
 let result,regulation=null;const type=g.gameOutcome?.lastPeriodType||g.periodDescriptor?.periodType;
 if(!['h2h','spreads','h2h_3_way','totals'].includes(snapshot.market))return {state:'pending',reason:'Unknown settlement market'};
 if(snapshot.market==='totals'){
  if(!['Over','Under'].includes(snapshot.side)||!Number.isFinite(snapshot.line)||snapshot.line<0)return {state:'pending',reason:'Invalid total selection'};
  const value=snapshot.side==='Over'?h+a-snapshot.line:snapshot.line-h-a;result=value>0?'win':value<0?'loss':'push';
 }else if(snapshot.market==='h2h_3_way'){
  if(type==='REG')regulation=h>a?'home':'away';
  else if(['OT','SO'].includes(type)&&Math.abs(h-a)===1)regulation='draw';
  else return {state:'pending',reason:'Regulation result is not verified'};
  result=snapshot.side.toLowerCase()===regulation?'win':'loss';
 }else{const margin=snapshot.side==='Home'?h-a:a-h,value=margin+(snapshot.market==='spreads'?snapshot.line:0);result=value>0?'win':value<0?'loss':'push'}
 return {state:result,finalHome:h,finalAway:a,...(regulation?{regulation}:{}),units:result==='win'?snapshot.quote.decimal-1:result==='loss'?-1:0};
}
const testCache=new Map();
export function gameBacktest(archive,market,side,point,before){
 const key=JSON.stringify([archive.generatedAt,market,side,point,before]);if(testCache.has(key))return testCache.get(key);
 const games=archive.games.filter(g=>g.date<before).sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id),predictions=[];
 for(let i=games.length-1;i>=0&&predictions.length<100;i--){
  const target=games[i],model=fitGame(games,target.home,target.away,target.date);if(!model)continue;
  const p=marketProbabilities(model,market,side,point),b=marketProbabilities({home:2.8,away:2.8,overtimeHome:.5},market,side,point);
  const fake={market,side,line:point,quote:{decimal:2}},official={gameState:'OFF',homeTeam:{score:target.finalHome},awayTeam:{score:target.finalAway},gameOutcome:{lastPeriodType:target.endType}},r=gradeGame(fake,official);
  if(r.state==='pending')continue;
  const loss=q=>market==='h2h_3_way'?['home','draw','away'].reduce((s,k)=>s+(q.regulation[k]-Number(k===r.regulation))**2,0)/2:['win','loss','push'].reduce((s,k)=>s+(q[k]-Number(k===r.state))**2,0)/2;
  predictions.push({date:target.date,trainingEnd:model.trainingEnd,loss:loss(p),baseline:loss(b)});
 }
 const result={games:predictions.length,brier:predictions.length?mean(predictions.map(p=>p.loss)):null,baseline:predictions.length?mean(predictions.map(p=>p.baseline)):null,tests:predictions};
 testCache.set(key,result);return result;
}
export function analyzeGame(archive,event,quote){
 const model=fitGame(archive.games,event.homeAbbrev,event.awayAbbrev,event.date);if(!model)return null;
 const probability=marketProbabilities(model,quote.market,quote.side,quote.point),baseline=marketProbabilities({home:2.8,away:2.8,overtimeHome:.5},quote.market,quote.side,quote.point),test=gameBacktest(archive,quote.market,quote.side,quote.point,event.date),scenarios=[];
 for(const h of [.85,1.15])for(const a of [.85,1.15])for(const overtimeHome of [.4,.6])scenarios.push(marketProbabilities({...model,home:model.home*h,away:model.away*a,overtimeHome},quote.market,quote.side,quote.point));
 return {model,probability,baseline,test,worstValue:Math.min(...scenarios.map(p=>gameValue(p,quote.decimal).ev)),archiveAt:archive.generatedAt,archiveErrors:archive.errors?.length||0};
}
export function gameChecks(analysis,quote,event,now=Date.now()){
 if(!analysis)return ['Fewer than 20 prior games per team'];const reasons=[];
 if(analysis.test.games<100)reasons.push('Fewer than 100 held-out game tests');
 if(analysis.test.brier===null||analysis.test.brier>analysis.test.baseline)reasons.push('Does not beat equal-strength baseline');
 if(gameValue(analysis.probability,quote.decimal).ev<=0)reasons.push('Non-positive estimated value');
 if(analysis.worstValue<=0)reasons.push('Fails goal-rate/OT sensitivity check');
 const age=now-Date.parse(quote.lastUpdate);if(!Number.isFinite(age)||age>15*60000||age< -60000)reasons.push('Quote stale or undated');
 if(!(Date.parse(event.startTime)>now))reasons.push('Game already started');
 if(!event.verified)reasons.push('Upcoming NHL matchup unverified');
 if(!confirmedGoalies(event,now)){reasons.push('Both starting goalies must be confirmed with fresh identity checks');const evidence=gameDayEvidence(event,now);for(const side of ['home','away']){const g=evidence[side];if(g.status!=='confirmed')reasons.push(g.team+' starting goalie is '+g.status+'; confirmation required')}if(evidence.reason)reasons.push(evidence.reason)}
 if(!Number.isFinite(Date.parse(analysis.archiveAt))||now-Date.parse(analysis.archiveAt)>48*3600000||Date.parse(analysis.archiveAt)>now+60000||analysis.archiveErrors)reasons.push('Team archive stale or incomplete');
 return reasons;
}


// Offline challenger only. No acquisition or production recommendation adjustment.
export function goalieAdjustedChallenger(model,event,evidence,now=Date.now()){
 if(!confirmedGoalies(event,now))return {available:false,reason:'Fresh confirmed starter identities required'};
 if(!model||![model.home,model.away].every(n=>Number.isFinite(n)&&n>0))return {available:false,reason:'Valid base goal rates required'};
 const adjustments={};
 for(const side of ['home','away']){
  const x=evidence?.[side],starter=event.gameDay[side].goalie;
  if(!x||String(x.playerId)!==String(starter.playerId)||x.metric!=='goals_saved_above_expected_per_60'||!Number.isFinite(x.value)||Math.abs(x.value)>3||!Number.isFinite(x.minutes)||x.minutes<600||typeof x.source!=='string'||!x.source.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(x.trainingEnd||'')||!(x.trainingEnd<event.date)||!Number.isFinite(Date.parse(x.publishedAt))||Date.parse(x.publishedAt)>now||now-Date.parse(x.publishedAt)>48*3600000)return {available:false,reason:'Matched pregame goalie-quality evidence with 600+ minutes required'};
  adjustments[side]=x.value*x.minutes/(x.minutes+1200);
 }
 // A home goalie's goals saved reduce the away scoring rate, and vice versa.
 return {available:true,version:'goalie-challenger-v1',experimental:true,promoted:false,base:{...model},model:{...model,home:clamp(model.home-adjustments.away,.25,6),away:clamp(model.away-adjustments.home,.25,6)},adjustments,evidence:structuredClone(evidence),limitations:['Fixed exposure shrinkage is a hypothesis, not a fitted coefficient','Requires unseen historical pregame evaluation before promotion','No live goalie-quality feed is enabled']};
}
