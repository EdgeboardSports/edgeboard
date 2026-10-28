import {passwordRoute} from '../lib/password-access.js';
import {authenticate,ACCESS_IDENTITY,securityHeaders,denied} from '../lib/access.js';
const pages=new Set(['','index','best-picks','game','game-markets','player','paper','props','odds','budget']);
const modules=new Set(['best-picks-engine.js','game-model.js','game-paper.js','game-day.js','paper-core.js','prop-history.js','quote-selection.js','research-context.js','shots-model.js','count-model.js','evaluation-core.js']);
export async function onRequest(context){
 let path;try{path=decodeURIComponent(new URL(context.request.url).pathname)}catch{return denied('Not found.',404)};
 if(path.includes('..')||path.includes('\\')||path.includes('//'))return denied('Not found.',404);
 const login=await passwordRoute(context.request,context.env);if(login)return login;
 const name=path.replace(/^\//,'').replace(/\.html$/,'').replace(/\/$/,'');
 const allowed=pages.has(name)||modules.has(path.slice(1))||/^\/assets\/(ui\.(js|css)|best-picks\.js)$/.test(path)||/^\/api\/[a-z-]+$/.test(path);
 if(!allowed)return denied('Not found.',404);
 const auth=await authenticate(context.request,context.env);if(auth.response)return auth.response;
 context.data[ACCESS_IDENTITY]=auth.identity;
 if(path.startsWith('/api/nhl-')&&!['/api/nhl-odds','/api/nhl-game-odds','/api/nhl-props','/api/nhl-events'].includes(path)&&(context.env.ALLOW_NHL_FEED!=='true'||context.env.ALLOW_ESPN_FEED!=='true'))return denied('Data collection paused pending provider permission review.');
 return securityHeaders(await context.next());
}
