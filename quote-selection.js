// Freshness is checked before price so stale quotes cannot displace usable prices.
export function freshQuote(q,now=Date.now()){
 const age=now-Date.parse(q.lastUpdate);
 return Number.isFinite(q.decimal)&&q.decimal>1&&Number.isFinite(age)&&age>=-60000&&age<=15*60000;
}
export function bestFreshQuotes(quotes,keyFor,now=Date.now()){
 const best=new Map();
 for(const q of quotes){if(!freshQuote(q,now))continue;const key=keyFor(q);if(!best.has(key)||q.decimal>best.get(key).decimal)best.set(key,q)}
 return [...best.values()];
}
