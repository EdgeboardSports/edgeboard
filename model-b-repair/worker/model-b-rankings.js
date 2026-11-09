// Rankings are research reports, never selection/settlement records.
export function modelBRankings(games,checkedAt) {
  const candidates=games.flatMap(game=>game.choices.map(choice=>({
    eventId:game.eventId,sourceGameId:game.sourceGameId,home:game.home,away:game.away,
    startAt:game.startAt,quoteAt:game.quoteAt,book:'draftkings',market:'h2h',...choice,
    researchOnly:true,officialSelection:false,context:game.factors||null,
    reasons:[...game.holds,
      ...(!(choice.edge>=.02)?['edge_below_0.02']:[]),
      ...(!(choice.expectedReturn>=.03)?['expected_return_below_0.03']:[]),
      ...(!(choice.conservativeReturn>0)?['conservative_return_not_positive']:[])]
  }))).filter(c=>[c.probability,c.edge,c.expectedReturn,c.conservativeReturn,c.decimal].every(Number.isFinite)&&c.probability>0&&c.probability<1&&c.decimal>1);
  // One side per matchup; maximize the same conservative return used for selection.
  candidates.sort((a,b)=>b.conservativeReturn-a.conservativeReturn||b.edge-a.edge||a.eventId.localeCompare(b.eventId)||a.side.localeCompare(b.side));
  const unique=[...new Map(candidates.map(c=>[c.eventId,candidates.find(x=>x.eventId===c.eventId)])).values()];
  const valid=unique.filter(c=>!c.reasons.some(r=>!['edge_below_0.02','expected_return_below_0.03','conservative_return_not_positive'].includes(r)));
  return {checkedAt,rankingRule:'conservative_return_then_edge_one_side_per_game',researchOnly:true,
    topThree:valid.slice(0,3).map((c,i)=>({...c,rank:i+1})),
    evaluated:unique,unrankable:games.filter(g=>!unique.some(c=>c.eventId===g.eventId)).map(g=>({eventId:g.eventId,sourceGameId:g.sourceGameId,home:g.home,away:g.away,reasons:g.holds})),
    qualifyingGames:valid.filter(c=>c.qualifies).length,selectionWrites:0};
}
