// Fixed research accounting window. This is not the provider billing/reset date.
// Never derive a fresh window from today's date: doing so would silently replenish the cap.
export const RESEARCH_BUDGET_PERIOD='2026-10-27';
export function budgetPeriod(env){
 const value=env.ODDS_BUDGET_PERIOD===undefined||env.ODDS_BUDGET_PERIOD===''?RESEARCH_BUDGET_PERIOD:env.ODDS_BUDGET_PERIOD;
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value?value:null;
}
