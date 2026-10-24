// Netlify Function: official NHL skater leader totals (not betting projections).
exports.handler = async () => {
  const url = 'https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=points,goals,assists,shots&limit=10';
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error('NHL API HTTP ' + response.status);
    const payload = await response.json();
    const result = {};
    for (const key of ['points', 'goals', 'assists', 'shots']) result[key] = Array.isArray(payload[key]) ? payload[key] : [];
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, body: JSON.stringify(result) };
  } catch (error) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Unable to retrieve NHL player leaders', detail: String(error.message || error) }) };
  }
};
