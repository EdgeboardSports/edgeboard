'use strict';
const { normalizeOdds, bestPrices } = require('../../lib/odds');

const respond = (statusCode, data, cache = 'no-store') => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': cache },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  if (event.httpMethod && event.httpMethod !== 'GET') return respond(405, { error: 'Method not allowed' });
  const key = process.env.THE_ODDS_API_KEY;
  if (!key) return respond(503, {
    status: 'not_configured',
    provider: 'the-odds-api.com',
    message: 'Live odds are not configured. No demo prices are represented as live.'
  });

  // Featured NHL markets cost credits. Use CDN caching to reduce duplicate fetches.
  const url = new URL('https://api.the-odds-api.com/v4/sports/icehockey_nhl/odds/');
  url.searchParams.set('apiKey', key);
  url.searchParams.set('regions', 'us');
  url.searchParams.set('markets', 'h2h,spreads,totals');
  url.searchParams.set('oddsFormat', 'american');

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) {
      return respond(response.status === 429 ? 429 : 502, {
        status: 'unavailable',
        message: response.status === 429 ? 'Odds API quota exceeded' : 'Odds provider temporarily unavailable'
      });
    }
    const raw = await response.json();
    const rows = normalizeOdds(raw);
    return respond(200, {
      status: 'live',
      provider: 'the-odds-api.com',
      fetchedAt: new Date().toISOString(),
      sport: 'icehockey_nhl',
      markets: ['h2h', 'spreads', 'totals'],
      note: 'Player props and three-way regulation markets are not included in this featured-market endpoint.',
      remainingCredits: response.headers.get('x-requests-remaining'),
      odds: rows,
      bestPrices: bestPrices(rows)
    }, 'public, max-age=300, s-maxage=900');
  } catch {
    return respond(502, { status: 'unavailable', message: 'Odds provider connection failed' });
  }
};
