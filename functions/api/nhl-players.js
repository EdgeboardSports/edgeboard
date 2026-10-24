
export async function onRequestGet() {
  const categories = [
    "points",
    "goals",
    "assists"
  ];

  const result = {};

  try {
    const responses = await Promise.all(
      categories.map(async (category) => {
        const url =
          `https://api-web.nhle.com/v1/skater-stats-leaders/current?categories=${category}&limit=100`;

        const response = await fetch(url, {
          headers: {
            Accept: "application/json"
          },
          signal: AbortSignal.timeout(12000)
        });

        if (!response.ok) {
          throw new Error(
            `${category}: NHL API returned ${response.status}`
          );
        }

        const data = await response.json();

        return [
          category,
          Array.isArray(data[category])
            ? data[category]
            : []
        ];
      })
    );

    for (const [category, players] of responses) {
      result[category] = players;
    }

    return Response.json(result, {
      headers: {
        "Cache-Control": "public, max-age=300"
      }
    });

  } catch (error) {
    return Response.json(
      {
        error: "Unable to retrieve NHL player statistics",
        detail: String(error.message || error)
      },
      { status: 502 }
    );
  }
}
