// No feed requests until authenticated runtime diagnostics establish readiness.
export async function requireCollectionReadiness(client,now=Date.now(),{through}={}){
 const status=await client('/api/feed-status');
 if(status?.schedule?.state!=='enabled'||status?.odds?.state!=='configured')throw Error('Collection paused: runtime feed checks are not ready');
 if(through!==undefined){const end=Date.parse(through),expires=Date.parse(status.authentication?.credentialExpiresAt);if(status.authentication?.method!=='collector'||!Number.isFinite(end)||end<=now||!Number.isFinite(expires)||expires<end)throw Error('Collection paused: collector credential does not cover the remaining trial window')}
 const budget=await client('/api/budget-status');
 const checked=Date.parse(budget?.checkedAt);
 if(!Number.isFinite(checked)||checked>now+5000||now-checked>60000||budget.oddsFeedEnabled!==true||!Number.isSafeInteger(budget.availableCredits)||budget.availableCredits<1||!Number.isSafeInteger(budget.protectedRemainingCredits)||budget.protectedRemainingCredits<101||budget.accountingPeriod!==status.accountingPeriod)throw Error('Collection paused: current shared quota is not ready');
 return {availableCredits:budget.availableCredits,accountingPeriod:budget.accountingPeriod};
}
