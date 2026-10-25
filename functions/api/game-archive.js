export async function onRequestGet(){
 try{const r=await fetch('https://raw.githubusercontent.com/EdgeboardSports/edgeboard/main/data/game-archive.json?minute='+Math.floor(Date.now()/60000),{cf:{cacheTtl:30},signal:AbortSignal.timeout(20000)});
 if(!r.ok)throw Error();const d=await r.json();if(d.schemaVersion!==1||!Array.isArray(d.games))throw Error();
 return new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=0, s-maxage=30'}});
 }catch{return new Response(JSON.stringify({message:'Team history archive is warming up or unavailable.'}),{status:503,headers:{'Content-Type':'application/json'}})}
}