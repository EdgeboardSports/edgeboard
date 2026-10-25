const NS='http://www.w3.org/2000/svg';
export const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e};
const icons={today:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',game:'M4 7h16v10H4z M8 3v4 M16 3v4 M8 11h2 M14 11h2 M8 14h8',player:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2',performance:'M4 20V10 M10 20V4 M16 20v-8 M22 20H2'};
export function icon(name){const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(NS,'path');path.setAttribute('d',icons[name]||icons.player);svg.append(path);return svg}
function brand(){const a=el('a',null,'brand');a.href='/';a.setAttribute('aria-label','Edgeboard home');a.append(el('span','E','brand-mark'),el('span','EDGEBOARD'));return a}
const entries=[['today','Today','/'],['game','Matchup','/game'],['player','Players','/player'],['performance','Performance','/paper']];
function navigation(active,cls){const nav=el('nav',null,cls);nav.setAttribute('aria-label',cls==='mobile-nav'?'Mobile navigation':'Main navigation');for(const[key,label,path]of entries){const a=el('a',null,'nav-link');a.href=path;const event=new URLSearchParams(location.search).get('event');if(key==='game'&&/^[a-f0-9]{32}$/.test(event||''))a.href+='?event='+event;a.append(icon(key),el('span',label));if(key===active)a.setAttribute('aria-current','page');nav.append(a)}return nav}
export function mountShell(active=document.body.dataset.page||'today'){
 if(document.querySelector('.app-sidebar'))return;
 document.body.classList.add('app-shell');
 const embed=new URLSearchParams(location.search).get('embed')==='1';if(embed)document.documentElement.classList.add('is-embedded');
 const side=el('aside',null,'app-sidebar');side.append(brand(),el('div','WORKSPACE','nav-label'),navigation(active,'app-nav'));
 const foot=el('div',null,'sidebar-foot'),badge=el('span','NHL research','chip mint');foot.append(badge,el('p','Live prices. Transparent models.\nPaper-tested before trusted.'),el('p','EDGEBOARD · V19'));side.append(foot);
 const top=el('div',null,'app-topbar');top.append(brand(),el('span',entries.find(e=>e[0]===active)?.[1]||'Edgeboard','topbar-label'));
 const right=el('div',null,'topbar-right'),help=el('a','How the models work');help.href='/game-markets#model-methodology';right.append(help,el('span','NHL · EXPERIMENTAL','chip'));top.append(right);
 document.body.prepend(top);document.body.prepend(side);document.body.append(navigation(active,'mobile-nav'));
 if(embed)for(const a of document.querySelectorAll('a[href]'))if(!a.getAttribute('href').startsWith('#'))a.target='_top';
}
export function teamLogo(code,cls='team-logo'){
 if(!/^[A-Z]{3}$/.test(code||''))return el('span',code||'NHL',cls);
 const img=el('img',null,cls);img.src='https://assets.nhle.com/logos/nhl/svg/'+code+'_light.svg';img.alt=code+' logo';img.loading='lazy';img.width=40;img.height=40;img.onerror=()=>{img.style.visibility='hidden'};return img;
}
const profileCache=new Map(),profileQueue=[];let profileActive=0;
function queueProfile(task){return new Promise((resolve,reject)=>{profileQueue.push({task,resolve,reject});pumpProfiles()})}
function pumpProfiles(){while(profileActive<2&&profileQueue.length){const q=profileQueue.shift();profileActive++;Promise.resolve().then(q.task).then(q.resolve,q.reject).finally(()=>{profileActive--;pumpProfiles()})}}
export function getProfile(id){if(!/^\d{7}$/.test(String(id||'')))return Promise.resolve(null);if(!profileCache.has(String(id)))profileCache.set(String(id),queueProfile(async()=>{const r=await fetch('/api/nhl-player-profile?id='+id);if(!r.ok)return null;return r.json()}).catch(()=>null));return profileCache.get(String(id))}
function silhouette(){const s=document.createElementNS(NS,'svg');s.setAttribute('viewBox','0 0 64 64');s.setAttribute('aria-hidden','true');s.innerHTML='<circle cx="32" cy="21" r="11" fill="currentColor"/><path d="M10 61v-6c0-13 10-21 22-21s22 8 22 21v6" fill="currentColor"/>';return s}
export function playerIdentity({id=null,name='NHL player',team=null,season=null,stat=null,compact=false,large=false}={}){
 const box=el('div',null,'player-identity'+(compact?' compact':'')+(large?' large':''));box.dataset.playerName=name;const portrait=el('span',null,'portrait');portrait.append(silhouette());const copy=el('div',null,'identity-copy');copy.append(el(compact||large?'h3':'h2',name),el('small',team||'NHL player','player-team'));if(stat)copy.append(el('span',stat,'stat-label'));box.append(portrait,copy);
 if(id)hydrateIdentity(box,{id,name,team},season);return box;
}
export function hydrateIdentity(box,player,season=null){
 if(!box||!/^\d{7}$/.test(String(player?.id||'')))return;
 const id=String(player.id);if(box.dataset.playerId===id)return;box.dataset.playerId=id;
 const portrait=box.querySelector('.portrait'),team=/^[A-Z]{3}$/.test(player.team||'')?player.team:null,name=player.name||box.dataset.playerName||'NHL player';
 const label=box.querySelector('.player-team');if(team){label.textContent=team+' · NHL';portrait.append(teamLogo(team,'team-badge'))}
 const img=el('img',null,'headshot');img.alt=name+' headshot';img.loading='lazy';img.decoding='async';let fallbackTried=false;
 img.onload=()=>{img.classList.add('loaded');portrait.classList.add('has-image')};
 img.onerror=async()=>{img.classList.remove('loaded');portrait.classList.remove('has-image');if(fallbackTried)return;fallbackTried=true;const p=await getProfile(id);if(p?.headshot&&p.headshot!==img.src)img.src=p.headshot;if(p?.team)label.textContent=p.team+(p.number?' · #'+p.number:'')+' · NHL'};
 portrait.append(img);
 const code=season&&/^\d{8}$/.test(String(season))?String(season):(()=>{const d=new Date(),y=d.getUTCFullYear()-(d.getUTCMonth()<6?1:0);return String(y)+String(y+1)})();
 if(team)img.src='https://assets.nhle.com/mugs/nhl/'+code+'/'+team+'/'+id+'.png';
 else getProfile(id).then(p=>{if(p?.headshot)img.src=p.headshot;if(p?.team){label.textContent=p.team+(p.number?' · #'+p.number:'')+' · NHL';portrait.append(teamLogo(p.team,'team-badge'))}});
}
export function hydrateNamedIdentities(player,season){for(const box of document.querySelectorAll('.player-identity'))if(box.dataset.playerName===player.name)hydrateIdentity(box,player,season)}
export function responsiveTables(root=document){
 for(const table of root.querySelectorAll('table:not([data-ui-ready])')){
  const rows=[...table.querySelectorAll('tr')],header=rows.find(r=>r.querySelector('th'));if(!header)continue;table.dataset.uiReady='1';table.classList.add('responsive-table');
  const names=[...header.children].map(c=>c.textContent.trim());if(!table.tHead){const head=document.createElement('thead');table.prepend(head);head.append(header)}
  if(!table.tBodies.length){const body=document.createElement('tbody');for(const row of rows)if(row!==header)body.append(row);table.append(body)}
  for(const row of table.querySelectorAll('tbody tr'))[...row.children].forEach((cell,i)=>{cell.dataset.label=names[i]||''});
 }
}
function foldPanels(){
 for(const box of document.querySelectorAll('.history:not([data-ui-folded])')){
  const table=box.querySelector('table');if(!table)continue;box.dataset.uiFolded='1';
  const strip=el('div',null,'form-strip');strip.setAttribute('aria-label','Recent over hit counts at the selected line');
  for(const row of [...table.querySelectorAll('tbody tr')].slice(0,3)){const cells=row.children;if(cells.length<3)continue;const item=el('div',null,'form-cell');item.append(el('small',cells[0].textContent+' · overs'),el('strong',cells[2].textContent.split(' ')[0]));strip.append(item)}
  const heading=box.querySelector('h3'),first=box.querySelector('p'),details=el('details',null,'panel-details');details.append(el('summary','Full history & venue splits'));
  const keep=new Set([heading,first]);for(const node of [...box.childNodes])if(!keep.has(node))details.append(node);box.append(strip,details);
 }
 for(const box of document.querySelectorAll('.model:not([data-ui-folded])')){
  const paragraphs=[...box.querySelectorAll(':scope > p')];if(paragraphs.length<2)continue;box.dataset.uiFolded='1';const h=box.querySelector('h3'),first=paragraphs[0],any=paragraphs.some(p=>p.textContent==='Passes exploratory checks. Research candidate only.');
  const details=el('details',null,'panel-details'),summary=el('summary',null);summary.append(el('span','Model reasoning & tests '),el('span',any?'Candidate · see side':'No qualifying side','chip '+(any?'mint':'amber')));details.append(summary);
  for(const node of [...box.childNodes])if(node!==h&&node!==first)details.append(node);box.append(details);
 }
}
let scheduled=false;
function decorate(){scheduled=false;responsiveTables();foldPanels()}
function scheduleDecorate(){if(!scheduled){scheduled=true;requestAnimationFrame(decorate)}}
mountShell();new MutationObserver(scheduleDecorate).observe(document.body,{childList:true,subtree:true});scheduleDecorate();
if(new URLSearchParams(location.search).get('embed')==='1'){
 let lastHeight=0;const send=()=>{const h=Math.ceil(document.body.getBoundingClientRect().height);if(h!==lastHeight){lastHeight=h;parent.postMessage({type:'edgeboard:height',height:h},location.origin)}};
 new ResizeObserver(send).observe(document.body);addEventListener('load',send);setTimeout(send,100);
}
