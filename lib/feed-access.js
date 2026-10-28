// Runtime feed gates only. An enabled flag does not itself certify source rights.
const oddsRoutes=new Set(['/api/nhl-odds','/api/nhl-game-odds','/api/nhl-props','/api/nhl-events']);
const nhlOnly=new Set(['/api/nhl-schedule','/api/nhl-roster','/api/nhl-player-search','/api/nhl-player-profile','/api/nhl-game-log','/api/nhl-players']);
export function requiredFeedSources(path){
 if(oddsRoutes.has(path))return ['odds'];
 if(nhlOnly.has(path))return ['nhl'];
 // Mixed context and unknown NHL endpoints keep both gates.
 return path.startsWith('/api/nhl-')?['nhl','espn']:[];
}
export function pausedFeedSources(path,env){
 return requiredFeedSources(path).filter(source=>env['ALLOW_'+source.toUpperCase()+'_FEED']!=='true');
}
export function feedCapabilities(env,oddsReady){
 const enabled=source=>env['ALLOW_'+source.toUpperCase()+'_FEED']==='true';
 return {schedule:enabled('nhl'),grading:enabled('nhl'),playerHistory:enabled('nhl'),lineupAndInjuryResearch:enabled('nhl')&&enabled('espn'),odds:oddsReady,automatedCapture:enabled('nhl')&&enabled('espn')&&oddsReady};
}
