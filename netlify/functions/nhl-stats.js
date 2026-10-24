exports.handler = async () => {
  try {
    const response = await fetch('https://api-web.nhle.com/v1/standings/now', { headers: { Accept: 'application/json', 'User-Agent': 'Edgeboard/1.0' }, signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new Error(`NHL API HTTP ${response.status}`);
    const data = await response.json();
    return { statusCode: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300' }, body: JSON.stringify({ standings: data.standings || [], source: 'NHL standings' }) };
  } catch (error) {
    return { statusCode: 502, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'NHL standings temporarily unavailable' }) };
  }
};
