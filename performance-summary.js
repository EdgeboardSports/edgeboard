import {aggregate} from './paper-core.js';
import {aggregateGames} from './game-paper.js';
export function performanceSummary(records, market, onlyCandidates=false) {
 const stats = (market === 'shots' ? aggregate : aggregateGames)(records, onlyCandidates);
 const comparable = Number.isFinite(stats.brier) && Number.isFinite(stats.baselineBrier);
 return {...stats,
  brierImprovement: comparable ? stats.baselineBrier - stats.brier : null,
  skill: comparable && stats.baselineBrier > 0 ? 1 - stats.brier / stats.baselineBrier : null,
  evidence: !stats.gradedGames ? 'No graded games yet.' : stats.gradedGames + ' distinct graded game'+(stats.gradedGames === 1 ? '' : 's')+'. Multiple selections within a game are correlated; results are descriptive and do not establish a reliable edge.'
 };
}
export function performanceGroups(records, market) {
 return [...new Set(records.map(r=>r.snapshot.modelVersion))].sort().map(version=>({version, all:performanceSummary(records.filter(r=>r.snapshot.modelVersion===version), market), candidates:performanceSummary(records.filter(r=>r.snapshot.modelVersion===version), market, true)}));
}
