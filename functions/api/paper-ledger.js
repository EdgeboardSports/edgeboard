export async function onRequestGet(){
 try{
 const r=await fetch('https://raw.githubusercontent.com/EdgeboardSports/edgeboard/main/data/paper-ledger.json?minute='+Math.floor(Date.now()/60000),{headers:{Accept:'application/json'},cf:{cacheTtl:30},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw Error('Unavailable');const data=await r.json();if(data.schemaVersion!==1||!Array.isArray(data.events))throw Error('Invalid ledger');
 return new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=0, s-maxage=30'}});
 }catch{return new Response(JSON.stringify({message:'Paper ledger temporarily unavailable.'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}
}