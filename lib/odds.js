'use strict';

/** Provider-neutral odds normalization. No API keys or paid providers required. */
const MARKETS = new Set(['h2h', 'spreads', 'totals', 'player_shots_on_goal', 'player_points', 'player_goals', 'player_assists']);
function decimalFromAmerican(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0 || Math.abs(n) < 100) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}
function impliedProbability(decimal) {
  const n = Number(decimal);
  return Number.isFinite(n) && n > 1 ? 1 / n : null;
}
function normalizeOdds(events) {
  if (!Array.isArray(events)) throw new TypeError('Expected events array');
  const rows = [];
  for (const event of events) {
    if (!event || !event.id || !Array.isArray(event.bookmakers)) continue;
    for (const book of event.bookmakers) {
      for (const market of book.markets || []) {
        if (!MARKETS.has(market.key)) continue;
        for (const outcome of market.outcomes || []) {
          const decimal = decimalFromAmerican(outcome.price);
          if (!decimal || !outcome.name) continue;
          rows.push({
            eventId: String(event.id),
            commenceTime: event.commence_time || null,
            homeTeam: event.home_team || null,
            awayTeam: event.away_team || null,
            bookmaker: book.key || null,
            bookmakerTitle: book.title || book.key || null,
            market: market.key,
            selection: String(outcome.name),
            description: outcome.description || null,
            point: Number.isFinite(Number(outcome.point)) && outcome.point != null ? Number(outcome.point) : null,
            american: Number(outcome.price),
            decimal,
            impliedProbability: impliedProbability(decimal),
            lastUpdate: market.last_update || book.last_update || null
          });
        }
      }
    }
  }
  return rows;
}
function bestPrices(rows) {
  const best = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.eventId, row.market, row.selection, row.description, row.point]);
    if (!best.has(key) || row.decimal > best.get(key).decimal) best.set(key, row);
  }
  return [...best.values()];
}
module.exports = { MARKETS, decimalFromAmerican, impliedProbability, normalizeOdds, bestPrices };
