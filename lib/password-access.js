import {securityHeaders,denied} from './access.js';
const enc=new TextEncoder(),COOKIE='__Host-edgeboard_session',TTL=86400;
const attempts=new Map(); // Best-effort per-isolate throttling; strong password remains required.
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function unb64(s){if(!/^[\w-]+$/.test(s))throw Error();return Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))}
const configured=env=>typeof env.EDGEBOARD_PASSWORD==='string'&&env.EDGEBOARD_PASSWORD.length>=24;
async function key(env){return crypto.subtle.importKey('raw',enc.encode(env.EDGEBOARD_PASSWORD),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])}
async function sign(env,text){return b64(await crypto.subtle.sign('HMAC',await key(env),enc.encode(text)))}
function redirect(path,cookie){return securityHeaders(new Response(null,{status:303,headers:{Location:path,...(cookie?{'Set-Cookie':cookie}:{})}}))}
function form(error='',status=200){return securityHeaders(new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Edgeboard · Private access</title><style>body{background:#0b1220;color:#edf2fa;font:17px system-ui;display:grid;place-items:center;min-height:95vh;margin:0}main{width:min(85vw,360px)}h1{font-size:36px}p{color:#aebed5}input,button{box-sizing:border-box;width:100%;padding:15px;border-radius:10px;font:inherit;margin:10px 0}button{background:#57ddae;border:0;color:#092319;font-weight:700}.error{color:#ffb4b4}</style><main><h1>Edgeboard</h1><p>Your private sports dashboard.</p><form method="post" action="/login"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="512"><button>Sign in</button></form><p class="error" role="alert">${error}</p></main></html>`,{status,headers:{'Content-Type':'text/html; charset=utf-8'}}))}
export async function passwordAuthenticate(request,env,now=Date.now()){
 if(!configured(env))return {response:denied('Set EDGEBOARD_PASSWORD to a unique password of at least 24 characters to enable private login.')};
 try{const raw=(request.headers.get('Cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);if(!raw||raw.length>2048)throw Error();
 const [payload,sig,...rest]=raw.split('.');if(rest.length||!sig)throw Error();
 if(!await crypto.subtle.verify('HMAC',await key(env),unb64(sig),enc.encode('edgeboard-session:'+new URL(request.url).origin+':'+payload)))throw Error();
 const c=JSON.parse(new TextDecoder().decode(unb64(payload))),t=now/1000;
 if(c.v!==1||!Number.isFinite(c.exp)||!Number.isFinite(c.iat)||c.iat>t+60||c.exp<=t||c.exp-c.iat!==TTL)throw Error();
 return {identity:{email:'private-owner',sub:'password-owner',expires:c.exp}};
 }catch{return {response:new URL(request.url).pathname.startsWith('/api/')?denied('Private authentication required.',401):redirect('/login')}}
}
export async function passwordRoute(request,env,now=Date.now()){
 const url=new URL(request.url);if(!['/login','/logout'].includes(url.pathname))return null;
 if(!configured(env))return denied('Set EDGEBOARD_PASSWORD to a unique password of at least 24 characters to enable private login.');
 if(url.protocol!=='https:')return denied('HTTPS required.',400);
 if(request.method==='GET'&&url.pathname==='/login')return form();
 if(request.method!=='POST')return denied('Method not allowed.',405);
 if(request.headers.get('Origin')!==url.origin)return denied('Invalid request origin.',403);
 if(url.pathname==='/logout')return redirect('/login',`${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=0`);
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';
 for(const [k,v]of attempts)if(v.until<=now)attempts.delete(k);
 const a=attempts.get(ip);if(a&&a.count>=5)return form('Too many attempts. Try again in 15 minutes.',429);
 if(attempts.size>=10000&&!a)return form('Please try again later.',429);
 attempts.set(ip,{count:(a?.count||0)+1,until:a?.until||now+900000});
 if(!request.headers.get('Content-Type')?.startsWith('application/x-www-form-urlencoded'))return denied('Invalid form.',400);
 // Bound actual body bytes even when Content-Length is absent or incorrect.
 let body='',size=0;const reader=request.body?.getReader();if(!reader)return form('Enter your password.',400);
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>4096){await reader.cancel();return denied('Form too large.',413)}body+=new TextDecoder().decode(value)}
 const password=new URLSearchParams(body).get('password')||'';
 const expected=await crypto.subtle.digest('SHA-256',enc.encode(env.EDGEBOARD_PASSWORD));const actual=await crypto.subtle.digest('SHA-256',enc.encode(password));
 let diff=0;const x=new Uint8Array(expected),y=new Uint8Array(actual);for(let i=0;i<x.length;i++)diff|=x[i]^y[i];
 if(diff)return form('Incorrect password.',401);
 attempts.delete(ip);const iat=Math.floor(now/1000),payload=b64(enc.encode(JSON.stringify({v:1,iat,exp:iat+TTL})));
 const sig=await sign(env,'edgeboard-session:'+url.origin+':'+payload);
 return redirect('/',`${COOKIE}=${payload}.${sig}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=${TTL}`);
}
