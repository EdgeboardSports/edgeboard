// Optional service identity. Disabled unless a hash and bounded validity window are configured.
export const COLLECTOR_ROUTES=new Set(['/api/feed-status','/api/budget-status','/api/nhl-events','/api/nhl-schedule','/api/nhl-roster','/api/nhl-game-log','/api/nhl-player-search','/api/nhl-team-context','/api/nhl-game-context','/api/nhl-props','/api/nhl-game-odds']);
export async function collectorIdentity(request,env,now=Date.now()){
 const token=request.headers.get('X-Edgeboard-Collector-Token');
 if(token===null)return null;
 const start=Date.parse(env.EDGEBOARD_COLLECTOR_NOT_BEFORE),end=Date.parse(env.EDGEBOARD_COLLECTOR_EXPIRES_AT),url=new URL(request.url);
 if(url.protocol!=='https:'||request.method!=='GET'||request.headers.has('Origin')||!COLLECTOR_ROUTES.has(url.pathname)||!/^([a-f0-9]{64})$/.test(token)||!/^([a-f0-9]{64})$/.test(env.EDGEBOARD_COLLECTOR_TOKEN_SHA256||'')||!Number.isFinite(start)||!Number.isFinite(end)||start>now||end<=now||end<=start||end-start>31*86400000)throw Error('Invalid collector authorization');
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
 const expected=env.EDGEBOARD_COLLECTOR_TOKEN_SHA256.match(/../g).map(x=>parseInt(x,16));
 let mismatch=0;for(let i=0;i<32;i++)mismatch|=digest[i]^expected[i];if(mismatch)throw Error('Invalid collector authorization');
 return {email:'private-collector',sub:'collector-service',kind:'collector',expires:end/1000};
}
