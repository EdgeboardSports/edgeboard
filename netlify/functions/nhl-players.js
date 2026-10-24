
// Netlify Function: NHL player statistics leaders
exports.handler = async () => {
  const categories = ['points', 'goals', 'assists', 'shots'];
  const result = {};

  try {
    for (const category of categories) {
      const url =
        `https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=${category}&limit=10`;

      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000)
      });

      if (!response.ok) {
        throw new Error(`${category}: NHL API HTTP ${response.status}`);
      }

      const data = await response.json();
      result[category] = Array.isArray(data[category])
        ? data[category]
        : [];
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify(result)
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Unable to retrieve NHL player leaders',
        detail: String(error.message || error)
      })
    };
  }
};
