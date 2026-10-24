
export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ||
    new Date().toISOString().slice(0, 10);

  const headers = {
    "Content-Type": "application/json"
  };

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(Date.parse(date))
  ) {
    return new Response(
      JSON.stringify({ error: "Invalid date" }),
      { status: 400, headers }
    );
  }

  try {
    const response = await fetch(
      `https://api-web.nhle.com/v1/score/${date}`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(12000)
      }
    );

    if (!response.ok) {
      throw new Error(`NHL API returned ${response.status}`);
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ games: data.games || [] }),
      {
        status: 200,
        headers: {
          ...headers,
          "Cache-Control": "public, max-age=60"
        }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "NHL data temporarily unavailable",
        detail: String(error.message || error)
      }),
      { status: 502, headers }
    );
  }
}
