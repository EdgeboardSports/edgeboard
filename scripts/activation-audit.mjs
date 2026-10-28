// Read-only audit inputs contain verified diagnostics and native schedule metadata, never tokens.
export function activationAudit({startAt,readiness,automations,now=Date.now()}={}){
 const start=Date.parse(startAt),end=start+30*86400000;if(!Number.isFinite(start)||new Date(start).toISOString()!==startAt||start%86400000||start<now)throw Error('Future UTC-midnight start required');
 const expiry=Date.parse(readiness?.credentialExpiresAt),checked=Date.parse(readiness?.checkedAt);
 const sourceFresh=Number.isFinite(checked)&&checked<=now+5000&&now-checked<=60000;
 const hourly=s=>{
  if(!s||s.is_enabled!==true||!['UTC','Etc/UTC'].includes(s.timezone)||typeof s.schedule!=='string'||!s.id)return false;
  const lines=s.schedule.split(/\r?\n/),rule=lines.find(l=>l.startsWith('RRULE:'));if(!rule)return false;
  const parts=rule.slice(6).split(';').map(v=>v.split('='));if(parts.some(v=>v.length!==2)||new Set(parts.map(v=>v[0])).size!==parts.length)return false;const r=Object.fromEntries(parts);
  // Conservative accepted hourly pattern; excludes expiry, skipped days and multiple starts/hour.
  return Object.keys(r).every(k=>['FREQ','INTERVAL','BYMINUTE','BYSECOND'].includes(k))&&r.FREQ==='HOURLY'&&(!r.INTERVAL||r.INTERVAL==='1')&&/^([0-9]|1[0-4])$/.test(r.BYMINUTE||'')&&r.BYSECOND==='0';
 };
 const schedules=Array.isArray(automations)?automations.filter(hourly):[];
 const gates={freshAuthenticatedSourceCheck:sourceFresh&&readiness?.verified===true&&readiness?.authentication==='collector',feedsReady:readiness?.schedule==='enabled'&&readiness?.odds==='configured',budgetReady:Number.isSafeInteger(readiness?.availableCredits)&&readiness.availableCredits>0&&readiness.protectedRemainingCredits>=101,credentialCoversWindow:Number.isFinite(expiry)&&expiry>=end,nativeScheduleMetadataAvailable:Array.isArray(automations),enabledHourlySchedule:schedules.length===1};
 return {checkedAt:new Date(now).toISOString(),startAt,endAt:new Date(end).toISOString(),credentialExpiresAt:Number.isFinite(expiry)?new Date(expiry).toISOString():null,credentialShortfallHours:Number.isFinite(expiry)?Math.max(0,(end-expiry)/3600000):null,gates,blockers:Object.entries(gates).filter(([,ok])=>!ok).map(([key])=>key),matchingScheduleIds:schedules.map(s=>s.id),activationApproved:false,providerRequests:0,notes:['Audit only: does not start a trial, rotate credentials or enable a schedule','Native schedule metadata must come from a fresh Sites get_site result','A schedule pattern is not proof that its writer ran; verify fresh cloud-task write/readback separately','Final grading and 14-day correction checks can require credential renewal after the trial window']};
}
