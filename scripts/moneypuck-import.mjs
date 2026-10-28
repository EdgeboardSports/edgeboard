import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const attribution='Historical research data: MoneyPuck.com — https://moneypuck.com/data.htm';
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function parseCsv(text){
 if(typeof text!=='string'||Buffer.byteLength(text)>10*1024*1024)throw Error('CSV must be at most 10 MiB');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 const push=()=>{row.push(field);field='';closed=false};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++}else{quoted=false;closed=true}}else field+=c;continue}
  if(c==='"'){if(field||closed)throw Error('Invalid CSV quote');quoted=true}
  else if(c===','){push()}
  else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;push();if(row.some(v=>v!==''))rows.push(row);row=[]}
  else{if(closed)throw Error('Characters after CSV quote');field+=c}
 }
 if(quoted)throw Error('Unterminated CSV quote');
 if(field||row.length||closed){push();if(row.some(v=>v!==''))rows.push(row)}
 if(rows.length<2||new Set(rows[0]).size!==rows[0].length||rows[0].some(h=>!h))throw Error('CSV header/data missing or duplicated');
 const [header,...data]=rows;if(data.some(r=>r.length!==header.length))throw Error('CSV row width mismatch');
 return {header,rows:data.map(values=>Object.fromEntries(header.map((h,i)=>[h,values[i]])))};
}
const num=(row,key,{integer=false}={})=>{const raw=row[key];if(typeof raw!=='string'||!raw.trim())throw Error('Missing number: '+key);const n=Number(raw);if(!Number.isFinite(n)||n<0||(integer&&!Number.isInteger(n)))throw Error('Invalid number: '+key);return n};
export function importMoneyPuck(text,{kind,season,retrievedAt=new Date().toISOString()}={}){
 if(!['goalies','skaters'].includes(kind)||!Number.isInteger(season)||season<2008||season>2100||!Number.isFinite(Date.parse(retrievedAt)))throw Error('Valid kind, season and retrieval time required');
 const parsed=parseCsv(text),required=['playerId','season','name','team','position','situation','games_played','icetime',...(kind==='goalies'?['xGoals','goals']:['I_F_shotsOnGoal','I_F_xGoals','I_F_goals'])];
 if(required.some(k=>!parsed.header.includes(k)))throw Error('Required MoneyPuck schema columns missing');
 const audit={sourceRows:parsed.rows.length,otherSituations:0,duplicateCopies:0,conflictingPlayers:0},groups=new Map();
 for(const row of parsed.rows){
  if(row.season!==String(season))throw Error('Wrong source season');
  if(row.situation!=='all'){audit.otherSituations++;continue}
  if(!/^\d{7}$/.test(row.playerId)||!row.name.trim()||row.name.length>120||!/^([A-Z]{2,4})$/.test(row.team)||(kind==='goalies'?row.position!=='G':!['C','D','L','R','LW','RW','F'].includes(row.position)))throw Error('Invalid player identity');
  const games=num(row,'games_played',{integer:true}),seconds=num(row,'icetime');if(games>100||seconds>500000||games===0&&seconds>0)throw Error('Invalid season exposure');
  const base={playerId:row.playerId,name:row.name,team:row.team,season,games,minutes:seconds/60};
  let normalized;
  if(kind==='goalies'){const expectedGoalsAgainst=num(row,'xGoals'),goalsAgainst=num(row,'goals',{integer:true});normalized={...base,expectedGoalsAgainst,goalsAgainst,goalsSavedAboveExpected:expectedGoalsAgainst-goalsAgainst,goalsSavedAboveExpectedPer60:seconds?(expectedGoalsAgainst-goalsAgainst)*3600/seconds:null}}
  else{const shots=num(row,'I_F_shotsOnGoal',{integer:true}),goals=num(row,'I_F_goals',{integer:true}),expectedGoals=num(row,'I_F_xGoals');if(goals>shots)throw Error('Goals exceed shots');normalized={...base,shots,goals,expectedGoals,shotsPerGame:games?shots/games:null,shotsPer60:seconds?shots*3600/seconds:null}}
  if(!groups.has(row.playerId))groups.set(row.playerId,[]);groups.get(row.playerId).push(normalized);
 }
 const players=[];for(const copies of groups.values()){if(new Set(copies.map(r=>JSON.stringify(r))).size>1){audit.conflictingPlayers++;continue}audit.duplicateCopies+=copies.length-1;players.push(copies[0])}
 players.sort((a,b)=>a.playerId.localeCompare(b.playerId));
 if(!players.length)throw Error('No valid all-situations records');
 return {schemaVersion:1,kind,season,retrievedAt:new Date(retrievedAt).toISOString(),attribution,sourceUrl:`https://moneypuck.com/moneypuck/playerData/seasonSummary/${season}/regular/${kind}.csv`,sha256:createHash('sha256').update(text).digest('hex'),researchOnly:true,historicalPublicationVerified:false,audit,players};
}
export function priorSeasonResearch(dataset,{targetDate}={}){
 if(dataset?.researchOnly!==true||!validDate(targetDate)||!Number.isInteger(dataset.season)||!Array.isArray(dataset.players))throw Error('Research dataset and valid target date required');
 // Whole-season totals cannot enter forecasts during that season; conservative July boundary.
 if(targetDate<`${dataset.season+1}-07-01`)throw Error('Season totals overlap target date');
 return {kind:dataset.kind,season:dataset.season,targetDate,attribution:dataset.attribution,sourceUrl:dataset.sourceUrl,sha256:dataset.sha256,researchOnly:true,historicalPublicationVerified:false,players:dataset.players.length,eligible600MinuteGoalies:dataset.kind==='goalies'?dataset.players.filter(p=>p.minutes>=600).length:null,eligible20GameSkaters:dataset.kind==='skaters'?dataset.players.filter(p=>p.games>=20).length:null,audit:dataset.audit,limitations:['Season-level summaries, not game-by-game observations','Download time does not prove historical publication time','No archived pregame starter/roster/injury confirmation is reconstructed','No model accuracy, ROI, production promotion or live trial claim']};
}
async function main(){
 const [seasonText,targetDate,goaliesPath,skatersPath]=process.argv.slice(2);if(!/^\d{4}$/.test(seasonText||'')||!goaliesPath||!skatersPath)throw Error('Usage: node scripts/moneypuck-import.mjs SEASON TARGET_DATE GOALIES_CSV SKATERS_CSV');
 const reports=[];for(const [kind,path] of [['goalies',goaliesPath],['skaters',skatersPath]]){const buffer=await readFile(path);if(buffer.length>10*1024*1024)throw Error('CSV too large');reports.push(priorSeasonResearch(importMoneyPuck(buffer.toString('utf8'),{kind,season:Number(seasonText)}),{targetDate}))}
 console.log(JSON.stringify({attribution,researchOnly:true,reports},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(error=>{console.error(error.message);process.exitCode=1});
