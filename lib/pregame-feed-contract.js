// Offline provider-neutral boundary. No network access, model adjustment or inferred clearance.
export const PREGAME_CONTRACT_VERSION='pregame-feed-contract-v1';
const fail=code=>{throw Error('Pregame feed rejected: '+code)};
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(v);
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v.slice(0,10)).toISOString().slice(0,10)===v.slice(0,10);
const team=v=>typeof v==='string'&&/^[A-Z]{2,3}$/.test(v);
export function normalizePregameFeed(input,{event,roster,approval,now=Date.now()}={}){
 if(!input||!id(input.provider)||approval?.approved!==true||approval.provider!==input.provider||typeof approval.reference!=='string'||!approval.reference.trim()||approval.reference.length>160||approval.privateRetentionApproved!==true||approval.audience!=='owner-only'||!Array.isArray(approval.allowedUses)||['pregame-analysis','prediction-tracking','historical-modeling'].some(use=>!approval.allowedUses.includes(use))||(approval.expiresAt!=null&&(!timestamp(approval.expiresAt)||Date.parse(approval.expiresAt)<=now)))fail('source_approval_required');
 if(!Number.isFinite(now)||!event||!id(event.providerGameId)||!/^\d{10}$/.test(String(event.nhlGameId))||!team(event.homeTeam)||!team(event.awayTeam)||event.homeTeam===event.awayTeam||!timestamp(event.startTime)||!Array.isArray(roster)||!roster.length)fail('trusted_identity_context_required');
 const fetched=Date.parse(input.retrievedAt),start=Date.parse(input.startTime),expected=Date.parse(event.startTime);
 if(input.gameId!==event.providerGameId||input.homeTeam!==event.homeTeam||input.awayTeam!==event.awayTeam||input.state!=='pregame'||!timestamp(input.retrievedAt)||fetched>now||now-fetched>180000||!timestamp(input.startTime)||start<=now||expected<=now||Math.abs(start-expected)>900000)fail('game_identity_or_freshness');
 const players=new Map(),officialIds=new Set();
 for(const p of roster){if(!id(p.providerPlayerId)||!/^\d{7}$/.test(String(p.nhlPlayerId))||![event.homeTeam,event.awayTeam].includes(p.team)||!['G','F','D'].includes(p.position)||players.has(p.providerPlayerId)||officialIds.has(String(p.nhlPlayerId)))fail('ambiguous_roster_mapping');players.set(p.providerPlayerId,p);officialIds.add(String(p.nhlPlayerId))}
 const mapped=(key,side)=>{const p=players.get(key);if(!p||p.team!==side)fail('player_identity_or_team');return p};
 const publication=value=>{if(value===null||value===undefined)return null;if(!timestamp(value)||Date.parse(value)>fetched||Date.parse(value)>=Math.min(start,expected))fail('invalid_publication_time');return new Date(value).toISOString()};
 const list=(value,max)=>{if(value===undefined)return [];if(!Array.isArray(value)||value.length>max)fail('bounded_report_required');return value};
 const seenGoalies=new Set(),seenAvailability=new Set(),seenLineups=new Set();
 const goalies=list(input.goalies,2).map(g=>{
  if(!g||seenGoalies.has(g.team)||![event.homeTeam,event.awayTeam].includes(g.team))fail('ambiguous_goalie_report');seenGoalies.add(g.team);
  const p=mapped(g.playerId,g.team);if(p.position!=='G')fail('goalie_position_mismatch');
  const publishedAt=publication(g.publishedAt),reportedStatus=['confirmed','projected'].includes(g.status)?g.status:'unknown';
  return {team:g.team,playerId:String(p.nhlPlayerId),reportedStatus,status:publishedAt?reportedStatus:'unknown',publishedAt,eligibleForPregameEvidence:!!publishedAt&&reportedStatus==='confirmed'};
 });
 const availability=list(input.availability,64).map(a=>{
  if(!a)fail('invalid_availability_report');const p=mapped(a.playerId,a.team);if(seenAvailability.has(a.playerId))fail('ambiguous_availability_report');seenAvailability.add(a.playerId);
  const publishedAt=publication(a.publishedAt),reportedStatus=['injured','out','questionable','scratched','active'].includes(a.status)?a.status:'unknown';
  return {team:a.team,playerId:String(p.nhlPlayerId),reportedStatus,status:publishedAt?reportedStatus:'unknown',publishedAt};
 });
 for(const g of goalies){g.conflictingAvailability=availability.some(a=>a.playerId===g.playerId&&['injured','out','scratched'].includes(a.status));if(g.conflictingAvailability){g.status='unknown';g.eligibleForPregameEvidence=false}}
 const lineups=list(input.lineups,2).map(l=>{
  if(!l||![event.homeTeam,event.awayTeam].includes(l.team)||seenLineups.has(l.team))fail('ambiguous_lineup_report');seenLineups.add(l.team);
  const ids=list(l.playerIds,23);if(new Set(ids).size!==ids.length)fail('ambiguous_lineup_players');
  const playerIds=ids.map(key=>String(mapped(key,l.team).nhlPlayerId)),publishedAt=publication(l.publishedAt),reportedStatus=['confirmed','projected'].includes(l.status)?l.status:'unknown';
  const conflicting=availability.some(a=>a.team===l.team&&playerIds.includes(a.playerId)&&['injured','out','scratched'].includes(a.status));
  return {team:l.team,playerIds,reportedStatus,status:publishedAt&&ids.length&&!conflicting?(reportedStatus==='confirmed'&&l.complete===true?'confirmed':reportedStatus==='projected'?'projected':'unknown'):'unknown',complete:!!publishedAt&&ids.length>0&&l.complete===true&&reportedStatus==='confirmed'&&!conflicting,publishedAt,conflictingAvailability:conflicting};
 });
 for(const l of lineups)if(l.complete){const g=goalies.find(g=>g.team===l.team&&g.status==='confirmed'&&!l.playerIds.includes(g.playerId));if(g){l.status='unknown';l.complete=false;l.conflictingGoalie=true;g.status='unknown';g.eligibleForPregameEvidence=false;g.conflictingLineup=true}}
 return {version:PREGAME_CONTRACT_VERSION,provider:input.provider,approvalReference:approval.reference,audience:'owner-only',gameId:String(event.nhlGameId),providerGameId:event.providerGameId,homeTeam:event.homeTeam,awayTeam:event.awayTeam,startTime:new Date(Math.min(start,expected)).toISOString(),checkedAt:new Date(fetched).toISOString(),goalies,availability,lineups,limitations:['Source approval is an externally verified prerequisite, not granted by this validator','Missing entries remain unknown; absent injury reports never imply clearance','Confirmed means provider-reported, not a guarantee against late changes','Publication times are mandatory for usable evidence; retrieval time is not announcement time','No live feed, production recommendation or model adjustment is enabled']};
}
