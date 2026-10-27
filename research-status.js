// Matches the checked-in collection hold. A heartbeat never overrides this state.
export const researchStatus = Object.freeze({
 collection: 'paused',
 title: 'Live collection paused',
 detail: 'Saved forecasts are frozen research records. New captures and automatic grading are paused; pending results may be out of date.'
});
export function collectionMessage(lastRunAt) {
 const t = Date.parse(lastRunAt);
 return researchStatus.title + '. ' + researchStatus.detail + (Number.isFinite(t) ? ' Last recorded run: ' + new Date(t).toLocaleString('en-US', {timeZone:'America/New_York'}) + ' ET.' : ' No recorded run available.');
}
