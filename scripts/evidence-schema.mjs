const text=x=>typeof x==='string'?x.slice(0,200):null;
export function normalizeEvidence({event,capturedAt,sourceCommit,phase='discovery'}){
 if(!/^[a-f0-9]{32}$/.test(event?.id||'')||!/^\d{10}$/.test(String(event.nhlGameId||''))||!['homeAbbrev','awayAbbrev'].every(k=>/^[A-Z]{3}$/.test(event[k]||''))||!Number.isFinite(Date.parse(capturedAt))||!(Date.parse(capturedAt)<Date.parse(event.startTime))||!['discovery','game_capture'].includes(phase))throw Error('Verified pregame identity and capture time required');
 const d=event.gameDay;
 const side=k=>{const t=d?.[k],g=t?.goalie;return {team:text(t?.team),goalie:{status:['confirmed','projected'].includes(g?.status)?g.status:'unknown',name:text(g?.name),playerId:/^\d{7}$/.test(g?.playerId||'')?g.playerId:null,source:'ESPN pregame probable starters',sourceUpdatedAt:text(g?.sourceUpdatedAt)},lineup:{status:t?.lineup?.players?.length?'reported':'unknown',completeLineup:false,source:'NHL game report',players:(t?.lineup?.players||[]).filter(p=>/^\d{7}$/.test(String(p.id))).map(p=>({id:String(p.id),name:text(p.name)}))}}};
 const gameDay=d?{gameId:String(d.gameId),date:text(d.date),startTime:text(d.startTime),gameState:text(d.gameState),pregame:d.pregame===true,checkedAt:text(d.checkedAt),home:side('home'),away:side('away')}:null;
 // Explicit field allowlist prevents accidental persistence of headers, credentials or provider payloads.
 return {schemaVersion:1,capturedAt:new Date(capturedAt).toISOString(),phase,sourceCommit:/^[a-f0-9]{7,40}$/.test(sourceCommit||'')?sourceCommit:null,event:{id:event.id,nhlGameId:String(event.nhlGameId),date:text(event.date),startTime:new Date(event.startTime).toISOString(),homeAbbrev:event.homeAbbrev,awayAbbrev:event.awayAbbrev,gameDay},goalieEvidence:null};
}
