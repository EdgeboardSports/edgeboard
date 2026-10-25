# Edgeboard V12 odds provider setup

This feature is **optional** and free-first. The production site does not require an odds subscription.

## Provider
The Odds API (https://the-odds-api.com/) v4 NHL featured markets (moneyline, puck line, totals). The advertised free tier provides 500 credits/month as of October 2026; check the provider's current terms before signing up. Player props and three-way regulation markets are not fetched in this initial version.

## Configure
1. Register for a free key with The Odds API. Do not commit the key or paste it into a public issue.
2. In Netlify site configuration, add an environment variable named `THE_ODDS_API_KEY` with the secret value. Make it available to Functions.
3. Deploy a preview, then request `/api/nhl-odds`. Without a key it intentionally returns HTTP 503 with `status: not_configured`.
4. With a key it returns normalized odds and bestPrices, plus the provider's remaining-credit response header.

## Credit conservation and caveats
- Request only US region and three featured markets.
- HTTP response specifies a 15-minute CDN shared cache, but verify Netlify's actual caching behavior before relying on this to control quota.
- **Every upstream request can consume credits.** Never schedule aggressive polling on the free plan. Check remaining credits and usage in the provider dashboard.
- There is no automatic paid upgrade in this code. Never activate a paid plan without owner approval.
- Sportsbook data may be delayed or unavailable. Use `lastUpdate` timestamps and do not infer a predictive betting edge from implied probability or past hit rates alone.
- A bookmaker's availability and permissions vary by geography and provider terms. Review display and redistribution rights before making the site public.
