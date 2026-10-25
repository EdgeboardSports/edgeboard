
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

  const requestedSeason = event.queryStringParameters?.season;
  if (requestedSeason !== undefined &&
      (!/^\d{8}$/.test(requestedSeason) ||
       Number(requestedSeason.slice(4)) !== Number(requestedSeason.slice(0, 4)) + 1)) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid season; expected consecutive years YYYYZZZZ' })
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

    // Explicit historical seasons take precedence over the player's current season.
    const season = requestedSeason || String(data.currentSeason ||
      data.featuredStats?.regularSeason?.subSeason?.season ||
      (() => {
        const now = new Date();
        const start = now.getUTCFullYear() - (now.getUTCMonth() < 6 ? 1 : 0);
        return `${start}${start + 1}`;
      })());

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

    const games = (Array.isArray(gameData.gameLog) ? gameData.gameLog : []).map(g => ({
      ...g, // Preserve NHL fields used by home/away and opponent analytics.
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

    const hitRate = (key, line, count = 10) => {
      const recent = games.slice(0, count);
      if (!recent.length) return null;

      const hits = recent.filter(
        (game) => game[key] > line
      ).length;

      return {
        line,
        games: recent.length,
        hits,
        percentage: Number(
          ((hits / recent.length) * 100).toFixed(1)
        )
      };
    };

    const propHitRates = {
      shotsOver2_5: {
        last5: hitRate('shots', 2.5, 5),
        last10: hitRate('shots', 2.5, 10),
        last20: hitRate('shots', 2.5, 20)
      },
      pointsOver0_5: {
        last5: hitRate('points', 0.5, 5),
        last10: hitRate('points', 0.5, 10),
        last20: hitRate('points', 0.5, 20)
      }
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
        propHitRates,
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
