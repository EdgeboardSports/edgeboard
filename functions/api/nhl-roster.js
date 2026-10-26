const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':status===200?'public, max-age=300':'no-store'}});
export async function onRequestGet({request}){
 const team=new URL(request.url).searchParams.get('team');
 if(!/^[A-Z]{3}$/.test(team||''))return json({message:'Valid NHL team abbreviation required'},400);
 try{
  const response=await fetch('https://api-web.nhle.com/v1/roster/'+team+'/current',{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('Roster unavailable');
  const data=await response.json();
  if(!['forwards','defensemen','goalies'].every(key=>Array.isArray(data[key])))throw Error('Invalid roster');
  const ids=[...data.forwards,...data.defensemen,...data.goalies].map(p=>String(p.id)).filter(id=>/^\d{7}$/.test(id));
  if(!ids.length)throw Error('Empty roster');
  return json({team,playerIds:[...new Set(ids)],checkedAt:new Date().toISOString(),source:'NHL current roster',lineupConfirmed:false});
 }catch{return json({message:'Official roster unavailable'},503)}
}
