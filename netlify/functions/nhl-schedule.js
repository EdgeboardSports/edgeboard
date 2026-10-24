exports.handler = async (event) => {
  const date = event.queryStringParameters?.date || new Date().toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z'))) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid date; expected YYYY-MM-DD' })
    };
  }

  try {
    const response = await fetch(`https://api-web.nhle.com/v1/score/${date}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Edgeboard/0.6'
      },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`NHL API returned HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      },
      body: JSON.stringify({ games: data.games || [] })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'NHL data temporarily unavailable',
        detail: String(error.message || error)
      })
    };
  }
};
