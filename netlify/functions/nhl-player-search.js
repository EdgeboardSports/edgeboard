
// Edgeboard V11 - NHL Player Search
// NHL public search API

exports.handler = async (event) => {
  const query = String(
    event.queryStringParameters?.q || ''
  ).trim().slice(0, 60);

  if (query.length < 2) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Enter at least 2 characters'
      })
    };
  }

  try {
    const url =
      'https://search.d3.nhle.com/api/v1/search/player' +
      '?culture=en-us&limit=20&q=' +
      encodeURIComponent(query);

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error('NHL search HTTP ' + response.status);
    }

    const data = await response.json();

    const players = (Array.isArray(data) ? data : [])
      .map(p => ({
        id: String(p.playerId || ''),
        name: p.name || '',
        team: p.teamAbbrev || '',
        position: p.positionCode || ''
      }))
      .filter(p => /^\d{7}$/.test(p.id));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=120'
      },
      body: JSON.stringify({
        query,
        count: players.length,
        players
      })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Unable to search NHL players',
        detail: String(error.message || error)
      })
    };
  }
};
