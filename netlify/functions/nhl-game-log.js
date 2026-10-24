
// Edgeboard NHL Player Game Log
// Uses the official NHL API.

exports.handler = async (event) => {
  const playerId = String(
    event.queryStringParameters?.playerId || ''
  );

  if (!/^\d{7}$/.test(playerId)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Provide a valid 7-digit NHL playerId'
      })
    };
  }

  try {
    const url =
      `https://api-web.nhle.com/v1/player/${playerId}/landing`;

    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`NHL API HTTP ${response.status}`);
    }

    const data = await response.json();

    const rawGames = Array.isArray(data.seasonTotals)
      ? data.seasonTotals
      : [];

    // Game-by-game records are supplied separately
    // by the NHL game-log endpoint.
    const season = data.featuredStats?.regularSeason
      ?.subSeason?.season || '20262027';

    const gameResponse = await fetch(
      `https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/2`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!gameResponse.ok) {
      throw new Error(
        `Game log HTTP ${gameResponse.status}`
      );
    }

    const gameData = await gameResponse.json();

    const games = (gameData.gameLog || []).map(g => ({
      date: g.gameDate,
      opponent: g.opponentAbbrev,
      homeAway: g.homeRoadFlag,
      goals: Number(g.goals || 0),
      assists: Number(g.assists || 0),
      points: Number(g.points || 0),
      shots: Number(g.shots || 0),
      toi: g.toi || null
    }));

    games.sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    const summarize = (count) => {
      const recent = games.slice(0, count);
      const n = recent.length;

      const average = (key) =>
        n ? Number(
          (recent.reduce((sum, g) =>
            sum + g[key], 0) / n).toFixed(2)
        ) : null;

      return {
        games: n,
        goalsPerGame: average('goals'),
        assistsPerGame: average('assists'),
        pointsPerGame: average('points'),
        shotsPerGame: average('shots')
      };
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300'
      },
      body: JSON.stringify({
        playerId,
        playerName: data.firstName?.default &&
          data.lastName?.default
          ? `${data.firstName.default} ${data.lastName.default}`
          : null,
        season,
        gamesPlayed: games.length,
        last5: summarize(5),
        last10: summarize(10),
        last20: summarize(20),
        games
      })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Unable to retrieve player game log',
        detail: String(error.message || error)
      })
    };
  }
};
