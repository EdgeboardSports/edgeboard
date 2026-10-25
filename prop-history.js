export function summarize(games,stat,line,count=Infinity){
 const sample=games.slice(0,count).map(g=>g[stat]).filter(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))).map(Number);
 const over=sample.filter(v=>v>line).length,under=sample.filter(v=>v<line).length,push=sample.length-over-under,decided=over+under;
 return {games:sample.length,over,under,push,overRate:decided?over/decided:null,underRate:decided?under/decided:null,average:sample.length?sample.reduce((a,b)=>a+b,0)/sample.length:null};
}
export function seasonFor(date){
 const d=new Date(date);if(!Number.isFinite(d.getTime()))throw Error('Game date unavailable');
 const year=d.getUTCFullYear()-(d.getUTCMonth()<6?1:0);return String(year)+String(year+1);
}
export function completedBefore(games,day){
 return games.filter(g=>/^\d{4}-\d{2}-\d{2}$/.test(g.gameDate||g.date||'')&&(g.gameDate||g.date)<day).sort((a,b)=>(b.gameDate||b.date).localeCompare(a.gameDate||a.date));
}
export const cleanName=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
