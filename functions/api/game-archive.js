export async function onRequestGet(){
 try{
  const r=await fetch('https://raw.githubusercontent.com/EdgeboardSports/edgeboard/main/data/game-archive.json?minute='+Math.floor(Date.now()/60000),{cf:{cacheTtl:30},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error();let d=await r.json();if(d.schemaVersion!==1||!Array.isArray(d.games))throw Error();
  // Raw-content caches can retain the initial empty/partial archive. Use the public
  // contents endpoint only during warm-up/repair, without adding any credentials.
  if(!d.generatedAt||!d.games.length||d.errors?.length){
   try{const fresh=await fetch('https://api.github.com/repos/EdgeboardSports/edgeboard/contents/data/game-archive.json?ref=main',{headers:{Accept:'application/vnd.github.raw+json','User-Agent':'Edgeboard-game-history'},cf:{cacheTtl:60},signal:AbortSignal.timeout(20000)});
    if(fresh.ok){const next=await fresh.json();if(next.schemaVersion===1&&Array.isArray(next.games)&&next.generatedAt)d=next}
   }catch{}
  }
  return new Response(JSON.stringify(d),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=0, s-maxage=30'}});
 }catch{return new Response(JSON.stringify({message:'Team history archive is warming up or unavailable.'}),{status:503,headers:{'Content-Type':'application/json'}})}
}