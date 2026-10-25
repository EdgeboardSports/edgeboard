# Edgeboard

NHL schedules, team statistics, player leaders, and historical player-prop analysis. The interface is static HTML; server functions retrieve public NHL data. No sportsbook odds feed or predictive model is connected yet.

## Development

Use Node.js 24 or newer. There are no npm dependencies or build step. In the published Codex cloud environment, start the retained local development helper:

```sh
cd /workspace/edgeboard
NODE_USE_ENV_PROXY=1 node /workspace/edgeboard-cloud/server.mjs
```

The helper serves the page on port 8888 and supports both function families. It is cloud-environment tooling outside the repository, not a production deployment emulator. Its `/api/*` routes invoke the Cloudflare handlers; test the Netlify handlers separately with the commands below. It does not implement Netlify rewrites.

Live HTTPS access to `api-web.nhle.com` and `search.d3.nhle.com` is confirmed in the published cloud environment. Keep both hosts allowed. Public NHL APIs need no credentials. Node fetch must use the environment proxy (`NODE_USE_ENV_PROXY=1`) and the supplied CA configuration. Processes need restarting in each new task; the environment snapshot retains files, not running services.

## Deployment and API contract

Netlify is the current deployment target. `netlify.toml` publishes the static site and deploys `netlify/functions`. The frontend exclusively uses `/api/*`; a forced HTTP 200 rewrite maps that namespace to `/.netlify/functions/*`. Native Netlify URLs remain available for existing clients.

| Public route | Purpose |
| --- | --- |
| `/api/nhl-schedule?date=YYYY-MM-DD` | Daily scores and schedule |
| `/api/nhl-stats` | Team standings |
| `/api/nhl-player-search?q=McDavid` | Player search |
| `/api/nhl-players` | Points, goals, and assists leaders |
| `/api/nhl-game-log?playerId=8478402&season=20252026` | Regular-season games and historical prop hit rates |
| `/api/nhl-prop-scanner?date=YYYY-MM-DD` | Scheduled matchups for prop analysis; no odds or projections |

Explicit game-log seasons must be consecutive years encoded as eight digits. Netlify honors the requested season; if omitted, it uses the player's current season metadata. Game objects preserve NHL fields (`gameDate`, `homeRoadFlag`, `opponentAbbrev`) alongside legacy Netlify aliases (`date`, `homeAway`, `opponent`). Existing Netlify summaries and hit-rate fields remain available.

Cloudflare Pages handlers live in `functions/api`. Their route namespace already matches the frontend. Before migrating, port standings and prop scanner handlers, align the remaining response differences (including leader limits and game-log summaries), and run the live checks against the deployment. Cloudflare's existing game-log handler defaults to 2026–27 when season is omitted; the interface always sends an explicit season. The cloud helper alone does not prove production routing.

Keep sport-specific endpoints and provider retrieval outside the interface. Future NFL, NBA, MLB, sportsbook odds comparison, moneyline/three-way/spread markets, player props, and statistical models should build on explicit API contracts and separate provider/model modules. This change adds no speculative markets or models.

## Validation

```sh
node --test tests/nhl.test.cjs
NODE_USE_ENV_PROXY=1 node tests/nhl-live.cjs
```

The offline suite checks season selection, input validation, upstream errors, analytics field compatibility, and route configuration. The opt-in live suite exercises all six Netlify and four existing Cloudflare endpoints against public NHL data, including a known 82-game historical player season. Live checks depend on upstream availability and may require updating the sample date/player as data changes.

After Netlify deploys a review build, smoke-test all six public routes above and their native Netlify equivalents. Production routing must be checked on Netlify; the local adapter does not apply its configuration.
