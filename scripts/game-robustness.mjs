import {createHash} from 'node:crypto';
import {fitGame,marketProbabilities,gradeGame,GAME_VERSION} from '../game-model.js';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
const avg=xs=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;
export function gameRobustness(archive,{before,includeTests=false}={}){
 if(!validDate(before)||!Array.isArray(archive?.games)||archive.games.length>10000)throw Error('Bounded archive and exclusive cutoff required');
 const audit={input:archive.games.length,invalid:0,duplicates:0,conflictingGames:0,excludedByCutoff:0,insufficientHistory:0},groups=new Map();
 for(const g of archive.games){if(!g||!Number.isSafeInteger(g.id)){audit.invalid++;continue}if(!groups.has(g.id))groups.set(g.id,[]);groups.get(g.id).push(g)}
 const valid=g=>validDate(g.date)&&/^\d{4}02\d{4}$/.test(String(g.id))&&Number.isSafeInteger(g.season)&&String(g.season)===String(g.id).slice(0,4)+String(Number(String(g.id).slice(0,4))+1)&&typeof g.home==='string'&&typeof g.away==='string'&&/^[A-Z]{2,4}$/.test(g.home)&&/^[A-Z]{2,4}$/.test(g.away)&&g.home!==g.away&&['homeGoals','awayGoals','finalHome','finalAway'].every(k=>Number.isSafeInteger(g[k])&&g[k]>=0&&g[k]<=30)&&g.finalHome!==g.finalAway&&['REG','OT','SO'].includes(g.endType)&&(g.endType==='REG'?g.homeGoals===g.finalHome&&g.awayGoals===g.finalAway:Math.abs(g.finalHome-g.finalAway)===1&&g.homeGoals===g.awayGoals&&g.homeGoals===Math.min(g.finalHome,g.finalAway));
 const games=[];for(const copies of groups.values()){
  if(copies.some(g=>!valid(g))){audit.invalid+=copies.length;continue}
  const canonical=g=>JSON.stringify(['id','season','date','home','away','homeGoals','awayGoals','finalHome','finalAway','endType'].map(k=>g[k]));
  if(new Set(copies.map(canonical)).size>1){audit.conflictingGames++;continue}audit.duplicates+=copies.length-1;
  if(copies[0].date>=before){audit.excludedByCutoff++;continue}games.push(copies[0]);
 }
 games.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id);
 const markets=[['h2h','Home',null],['h2h_3_way','Draw',null],['spreads','Home',-1.5],['totals','Over',6.5]].map(([market,side,line])=>({market,side,line,tests:[]}));
 for(const g of games){const model=fitGame(games,g.home,g.away,g.date);if(!model){audit.insufficientHistory++;continue}if(!(model.trainingEnd<g.date))throw Error('Training chronology failed');
  const official={id:g.id,gameState:'OFF',homeTeam:{score:g.finalHome},awayTeam:{score:g.finalAway},gameOutcome:{lastPeriodType:g.endType}};
  for(const m of markets){const result=gradeGame({nhlGameId:g.id,market:m.market,side:m.side,line:m.line,quote:{decimal:2}},official);if(result.state==='pending')throw Error('Validated final could not settle');
   const modelP=marketProbabilities(model,m.market,m.side,m.line),baseP=marketProbabilities({home:2.8,away:2.8,overtimeHome:.5},m.market,m.side,m.line);
   const distribution=p=>m.market==='h2h_3_way'?p.regulation:{win:p.win,loss:p.loss,push:p.push},actual=m.market==='h2h_3_way'?result.regulation:result.state,score=p=>Object.entries(distribution(p)).reduce((n,[k,v])=>n+(v-Number(k===actual))**2,0)/2;
   m.tests.push({id:g.id,date:g.date,trainingEnd:model.trainingEnd,loss:score(modelP),baseline:score(baseP),logLoss:-Math.log(Math.max(1e-15,distribution(modelP)[actual])),baselineLogLoss:-Math.log(Math.max(1e-15,distribution(baseP)[actual])),probabilities:distribution(modelP),actual});
  }
 }
 const summarize=tests=>({games:tests.length,brier:avg(tests.map(t=>t.loss)),baseline:avg(tests.map(t=>t.baseline)),logLoss:avg(tests.map(t=>t.logLoss)),baselineLogLoss:avg(tests.map(t=>t.baselineLogLoss))});
 const robust=tests=>{const map=new Map();for(const t of tests){if(!map.has(t.date))map.set(t.date,{n:0,b:0,l:0});const d=map.get(t.date);d.n++;d.b+=t.baseline-t.loss;d.l+=t.baselineLogLoss-t.logLoss}
  const dates=[...map.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([,d])=>d),b=[],l=[];let state=20261028;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  if(dates.length>=20)for(let i=0;i<2000;i++){let n=0,bs=0,ls=0;for(let j=0;j<dates.length;j++){const d=dates[Math.floor(rand()*dates.length)];n+=d.n;bs+=d.b;ls+=d.l}b.push(bs/n);l.push(ls/n)}
  const interval=values=>{if(!values.length)return null;values.sort((a,b)=>a-b);return {lower:values[Math.floor(.025*(values.length-1))],upper:values[Math.ceil(.975*(values.length-1))]}};
  return {method:'paired game-date cluster bootstrap percentile',seed:20261028,distinctDates:dates.length,replicates:b.length,brierImprovement95:interval(b),logLossImprovement95:interval(l)};
 };
 return {model:GAME_VERSION,cutoff:before,archiveAt:archive.generatedAt||null,researchOnly:true,promoted:false,audit,markets:markets.map(({tests,...m})=>({...m,...summarize(tests),first:tests[0]?.date||null,last:tests.at(-1)?.date||null,chronologyValid:tests.every(t=>t.trainingEnd<t.date),robustness:robust(tests),calibration:Array.from({length:5},(_,i)=>{const observations=tests.flatMap(t=>Object.entries(t.probabilities).filter(([k])=>m.market==='h2h_3_way'||k==='win').map(([k,p])=>({p,y:Number(k===t.actual)}))).filter(t=>Math.min(4,Math.floor(t.p*5))===i);return {lower:i/5,upper:(i+1)/5,n:observations.length,predicted:avg(observations.map(t=>t.p)),observed:avg(observations.map(t=>t.y))}}),byMonth:[...new Set(tests.map(t=>t.date.slice(0,7)))].sort().map(month=>({month,...summarize(tests.filter(t=>t.date.startsWith(month)))})),...(includeTests?{tests}:{})})),limitations:['Full eligible saved sample; reused retrospective development data, not a new untouched holdout','Outcomes assumed available by next game date; actual publication/revision times unverified','Equal-strength baseline is not a sportsbook forecast; fixed illustrative -1.5 spread and 6.5 total','Brier uses half squared multiclass error; three-way and binary magnitudes are not directly comparable','Bootstrap groups whole dates but does not capture all cross-date/team dependence or model tuning','Four market comparisons use unadjusted descriptive intervals; no multiple-testing correction','No verified pregame goalie/lineup history, historical odds, ROI or prospective trial','Production formulas, model versions and source gates remain unchanged; no automatic promotion']};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{const raw=await readFile(new URL('../data/game-archive.json',import.meta.url),'utf8'),archive=JSON.parse(raw);console.log(JSON.stringify({...gameRobustness(archive,{before:process.argv[2]}),archiveSha256:createHash('sha256').update(raw).digest('hex')},null,2))}catch{console.error('Game robustness report failed; no production model changes.');process.exitCode=1}}
