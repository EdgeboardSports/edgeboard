
exports.handler = async (event) => {
  try {
    const date =
      event.queryStringParameters?.date ||
      new Date().toISOString().slice(0, 10);

   
    const response = await fetch(
      `https://api-web.nhle.com/v1/schedule/${date}`
    );

    if (!response.ok) {
      throw new Error("Unable to retrieve NHL schedule");
    }

    const schedule = await response.json();

    const games = (schedule.gameWeek || [])
      .filter((day) => day.date === date)
      .flatMap((day) => day.games || [])
      .map((game) => ({
        gameId: game.id,
        awayTeam: game.awayTeam?.abbrev,
        homeTeam: game.homeTeam?.abbrev,
        startTimeUTC: game.startTimeUTC
      }));

      return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify({
        success: true,
        scanner: "Edgeboard NHL Prop Scanner",
        
        
        date,
        status: "NHL schedule connected",
        gameCount: games.length,
        games

      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };
  }
};
