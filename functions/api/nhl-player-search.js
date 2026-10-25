
export async function onRequestGet({ request }) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300"
  };

  const json = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });

  const query = new URL(request.url)
    .searchParams.get("q")?.trim() || "";

  if (query.length < 2) {
    return json({
      players: [],
      error: "Enter at least 2 characters"
    }, 400);
  }

  try {
    const url =
      "https://search.d3.nhle.com/api/v1/search/player" +
      "?culture=en-us&limit=50&q=" +
      encodeURIComponent(query);

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12000)
    });

    if (!response.ok) {
      throw new Error(`NHL search HTTP ${response.status}`);
    }

    const data = await response.json();

    const players = (Array.isArray(data) ? data : [])
      .map(player => ({
        id: String(player.playerId || ""),
        name: player.name || "",
        team: player.teamAbbrev || "",
        position: player.positionCode || "",
        active: player.active === true
      }))
      .filter(player => /^\d{7}$/.test(player.id));

    return json({
      query,
      count: players.length,
      players
    });
  } catch (error) {
    return json({
      players: [],
      error: "Unable to search NHL players",
      detail: String(error.message || error)
    }, 502);
  }
}
