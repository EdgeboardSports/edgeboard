
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=300"
    }
  });

export async function onRequestGet({ request }) {
  const params = new URL(request.url).searchParams;
  const playerId = params.get("playerId");
  const season = params.get("season") || "20262027";

  if (!/^\d{7}$/.test(playerId || "")) {
    return json({ error: "Valid 7-digit playerId required" }, 400);
  }

  if (!/^\d{8}$/.test(season) ||
      Number(season.slice(4)) !== Number(season.slice(0, 4)) + 1) {
    return json({ error: "Invalid season" }, 400);
  }

  try {
    const url =
      `https://api-web.nhle.com/v1/player/${playerId}/game-log/${season}/2`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();
    const games = Array.isArray(data.gameLog)
      ? data.gameLog
      : [];

    const summarize = (count) => {
      const sample = games.slice(0, count);
      const total = (key) =>
        sample.reduce((sum, game) => sum + (Number(game[key]) || 0), 0);

      const played = sample.length;
      const avg = (key) =>
        played ? Number((total(key) / played).toFixed(2)) : 0;

      return {
        games: played,
        goals: total("goals"),
        assists: total("assists"),
        points: total("points"),
        shots: total("shots"),
        averageGoals: avg("goals"),
        averageAssists: avg("assists"),
        averagePoints: avg("points"),
        averageShots: avg("shots")
      };
    };

    const hitRate = (key, threshold, count = 10) => {
      const sample = games.slice(0, count);
      if (!sample.length) return null;

      const hits = sample.filter(
        (game) => (Number(game[key]) || 0) > threshold
      ).length;

      return {
        hits,
        games: sample.length,
        rate: Number((hits / sample.length).toFixed(3))
      };
    };

    return json({
      playerId,
      season,
      gamesPlayed: games.length,
      last5: summarize(5),
      last10: summarize(10),
      last20: summarize(20),
      propHitRates: {
        shotsOver1_5: hitRate("shots", 1.5),
        shotsOver2_5: hitRate("shots", 2.5),
        shotsOver3_5: hitRate("shots", 3.5),
        pointsOver0_5: hitRate("points", 0.5),
        goalsOver0_5: hitRate("goals", 0.5),
        assistsOver0_5: hitRate("assists", 0.5)
      },
      games
    });
  } catch (error) {
    return json({
      error: "Unable to retrieve player game log",
      detail: String(error.message || error)
    }, 502);
  }
}
