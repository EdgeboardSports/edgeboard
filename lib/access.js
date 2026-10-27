import {passwordAuthenticate} from './password-access.js';
export const ACCESS_IDENTITY=Symbol('verified-cloudflare-access-identity');
const keys=new Map();
export function securityHeaders(response){
 const headers=new Headers(response.headers);
 for(const [k,v]of Object.entries({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin','X-Frame-Options':'SAMEORIGIN','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Strict-Transport-Security':'max-age=31536000','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'; object-src 'none'"}))headers.set(k,v);
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
export const denied=(message,status=503)=>securityHeaders(new Response(JSON.stringify({message}),{status,headers:{'Content-Type':'application/json'}}));
function bytes(s){if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error('Invalid encoding');return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))}
export async function authenticate(request,env,now=Date.now()){
 if(env.EDGEBOARD_PASSWORD!==undefined)return passwordAuthenticate(request,env,now);
 const domain=String(env.ACCESS_TEAM_DOMAIN||'').replace(/\/$/,''),aud=env.ACCESS_AUD,emails=String(env.ACCESS_ALLOWED_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(domain)||typeof aud!=='string'||!aud||!emails.length)return {response:denied('Private access setup is incomplete. Public access is disabled.')};
 const token=request.headers.get('Cf-Access-Jwt-Assertion');if(!token||token.length>16000)return {response:denied('Private authentication required.',401)};
 try{
  const parts=token.split('.');if(parts.length!==3)throw Error('Invalid token');
  const header=JSON.parse(new TextDecoder().decode(bytes(parts[0]))),claims=JSON.parse(new TextDecoder().decode(bytes(parts[1]))),seconds=now/1000;
  if(header.alg!=='RS256'||typeof header.kid!=='string'||claims.iss!==domain||!Array.isArray(claims.aud)||!claims.aud.includes(aud)||!Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.iat)||claims.iat>seconds+60||(claims.nbf!=null&&(!Number.isFinite(claims.nbf)||claims.nbf>seconds+60))||!emails.includes(String(claims.email||'').toLowerCase())||claims.type!=='app')throw Error('Invalid claims');
  let cached=keys.get(domain);if(!cached||cached.expires<=now){const r=await fetch(domain+'/cdn-cgi/access/certs',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Signing keys unavailable');const d=await r.json();if(!Array.isArray(d.keys))throw Error('Invalid signing keys');cached={keys:d.keys,expires:now+300000};keys.set(domain,cached)}
  const matches=cached.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA');if(matches.length!==1)throw Error('Unknown signing key');
  const key=await crypto.subtle.importKey('jwk',matches[0],{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,bytes(parts[2]),new TextEncoder().encode(parts[0]+'.'+parts[1])))throw Error('Invalid signature');
  return {identity:{email:String(claims.email).toLowerCase(),expires:claims.exp,sub:claims.sub||null}};
 }catch{return {response:denied('Private authentication could not be verified.',401)}}
}
