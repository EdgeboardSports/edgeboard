import {authorizeProvider,recordProviderResponse,rememberEvents} from '../../lib/provider-security.js';
// Cloudflare Pages Function: /api/nhl-odds
// Free-tier friendly: server-side secret, one NHL region, three featured markets.
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
});
const decimal = (p) => {
  const n = Number(p);
  if (!Number.isFinite(n) || Math.abs(n) < 100) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
};
const normalize = (games) => {
  const odds = [];
  for (const game of games) for (const book of game.bookmakers || []) {
    for (const market of book.markets || []) {
      if (!['h2h', 'spreads', 'totals'].includes(market.key)) continue;
      for (const outcome of market.outcomes || []) {
        const d = decimal(outcome.price);
        if (!d || !outcome.name) continue;
        odds.push({
          eventId: String(game.id), commenceTime: game.commence_time || null,
          homeTeam: game.home_team || null, awayTeam: game.away_team || null,
          bookmaker: book.key || null, bookmakerTitle: book.title || book.key || null,
          market: market.key, selection: outcome.name,
          description: outcome.description || null,
          point: outcome.point == null ? null : Number(outcome.point),
          american: Number(outcome.price), decimal: d,
          impliedProbability: 1 / d,
          lastUpdate: market.last_update || book.last_update || null
        });
      }
    }
  }
  const best = new Map();
  for (const row of odds) {
    const id = JSON.stringify([row.eventId, row.market, row.selection, row.description, row.point]);
    if (!best.has(id) || row.decimal > best.get(id).decimal) best.set(id, row);
  }
  return { odds, bestPrices: [...best.values()] };
};
export async function onRequestGet(context) {
  const {env,request}=context;const blocked=await authorizeProvider(context,3);if(blocked)return blocked;
  if (!env.THE_ODDS_API_KEY) return json({ status: 'not_configured', message: 'Live odds key is not configured.' }, 503);
  // Only cache publicly safe response data; never include the provider key in cache URL.
  const cacheKey = new Request(new URL('/api/nhl-odds', request.url).toString(), { method: 'GET' });
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;
  const endpoint = new URL('https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/');
  endpoint.searchParams.set('apiKey', env.THE_ODDS_API_KEY);
  endpoint.searchParams.set('regions', 'us');
  endpoint.searchParams.set('markets', 'h2h,spreads,totals');
  endpoint.searchParams.set('oddsFormat', 'american');
  try {
    const upstream = await fetch(endpoint.toString(), { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    await recordProviderResponse(env,upstream);
    if (!upstream.ok) return json({
      status: 'unavailable', message: upstream.status === 429 ? 'Odds provider quota exhausted' : 'Odds provider unavailable'
    }, upstream.status === 429 ? 429 : 502);
    const games = await upstream.json();
    if (!Array.isArray(games)) return json({ status: 'unavailable', message: 'Unexpected provider response' }, 502);
    const result = normalize(games);
    const output = json({
      status: 'live', provider: 'the-odds-api.com', fetchedAt: new Date().toISOString(),
      sport: 'icehockey_nhl', markets: ['h2h', 'spreads', 'totals'],
      note: 'Player props and regulation three-way markets are not yet connected.',
      remainingCredits: upstream.headers.get('x-requests-remaining'),
      ...result
    }, 200, { 'Cache-Control': 'public, max-age=300, s-maxage=3600' });
    await cache.put(cacheKey, output.clone());
    return output;
  } catch {
    return json({ status: 'unavailable', message: 'Odds provider connection failed' }, 502);
  }
}

