// No feed requests until authenticated runtime diagnostics establish readiness.
export async function requireCollectionReadiness(client,now=Date.now()){
 const status=await client('/api/feed-status');
 if(status?.schedule?.state!=='enabled'||status?.odds?.state!=='configured')throw Error('Collection paused: runtime feed checks are not ready');
 const budget=await client('/api/budget-status');
 const checked=Date.parse(budget?.checkedAt);
 if(!Number.isFinite(checked)||checked>now+5000||now-checked>60000||budget.oddsFeedEnabled!==true||!Number.isSafeInteger(budget.availableCredits)||budget.availableCredits<1||!Number.isSafeInteger(budget.protectedRemainingCredits)||budget.protectedRemainingCredits<101||budget.accountingPeriod!==status.accountingPeriod)throw Error('Collection paused: current shared quota is not ready');
 return {availableCredits:budget.availableCredits,accountingPeriod:budget.accountingPeriod};
}
