# Approved-feed integration boundary

Prepared October 28, 2026. `lib/pregame-feed-contract.js` is an offline, provider-neutral validator and normalizer, not a MySportsFeeds/NHL/ESPN adapter or a grant of rights. It has no network, credentials, cache, storage or model calls. It is not wired into recommendations or enabled endpoints. Existing feed gates remain unchanged.

## Trusted context

The future server adapter must supply these options from independently verified sources, never from the feed payload:

- `approval`: exact provider identifier, `approved:true`, an audit reference to written permission, `privateRetentionApproved:true`, `audience:'owner-only'`, and `allowedUses` containing pregame-analysis, prediction-tracking and historical-modeling. If an expiration exists, supply `expiresAt`; expired or invalid approval is rejected. These fields record a human-reviewed decision; setting them does not establish a license. If terms do not permit every intended use, keep the integration held or revise its scope explicitly.
- `event`: canonical providerGameId mapped to an official 10-digit NHL game ID, homeTeam/awayTeam codes and verified startTime. Do not identify a game by display names alone.
- `roster`: unique providerPlayerId to 7-digit NHL player ID mapping, team, and normalized position G/F/D, established against an appropriate current roster. No fuzzy name matching or first-match fallback. Duplicate provider or NHL IDs reject the packet. The adapter remains responsible for verifying roster freshness and team aliases before this boundary.
- `now`: the server's actual capture clock. This is not a historical replay clock permitting retroactive pregame captures. Historical modeling also requires immutable publication/capture evidence preserved by the private journal.

## Provider-neutral input

Adapters translate the authorized provider response into:

```
{
  provider, gameId, homeTeam, awayTeam, startTime,
  state: 'pregame', retrievedAt,
  goalies: [{team, playerId, status, publishedAt}],
  availability: [{team, playerId, status, publishedAt}],
  lineups: [{team, playerIds, status, complete, publishedAt}]
}
```

Player/game identifiers here are provider IDs; the trusted mapping supplies NHL IDs. Goalies accept explicit confirmed/projected status only. Availability accepts injured/out/questionable/scratched/active; all other values become unknown. Lineup status accepts confirmed/projected, with complete confirmation requiring an explicit complete flag and a nonempty uniquely mapped list. Confirmation describes provider reporting, not an independently verified dressing list.

Game IDs and both teams must match exactly. Both start times must remain future and differ by no more than 15 minutes; the earlier start is retained. All timestamps require valid ISO dates, explicit Z/UTC offsets and seconds; local/ambiguous times are rejected. Retrieval must be no older than three minutes and cannot be in the future. Supplied publication times cannot follow retrieval or the earlier start. Missing publication times are preserved as unknown, never replaced by retrieval timestamps. Without publication evidence, confirmed/active claims cannot become usable pregame evidence. Fresh retrieval does not prove an old report was correct or unrevised.

Duplicate or mismatched players, wrong positions for goalies, multiple starters per team, invalid timestamps, oversized arrays and conflicting duplicate availability reports reject the packet. Confirmed goalies reported injured/out/scratched become unknown and ineligible. A lineup containing players with those explicit availability reports loses complete confirmation. A declared complete lineup excluding the reported confirmed starter makes both claims unknown. Missing injury entries do not imply clearance; missing teams and empty lists do not imply confirmed lineups. This contract does not quantify injury, starter or lineup effects on probabilities.

## Adapter behavior required before activation

1. Confirm written rights and intended owner-only audience; do not infer permission from this schema.
2. Resolve provider aliases, matchup and player mappings, and fresh roster context.
3. Fetch only authorized fields within existing budgets; preserve actual retrieval/publication distinctions.
4. Pass the normalized input and trusted context through the contract. On rejection, discard stale confirmation; never silently reuse an older successful packet.
5. Store only the allowlisted result in the existing private evidence journal before freezing a prediction. Do not copy raw licensed payloads or contact/license correspondence into the public Git repository.
6. Verify snapshots/readback and prospective/historical chronology before connecting a versioned model. Do not enable collection or promote a challenger merely because parsing passes.

The output allowlists canonical IDs, statuses, timestamps and a local approval reference, dropping unknown raw fields. Audit references must be nonsecret identifiers, never API keys, emails or license text. Future public/shared use requires a new licensing and access review; this owner-only boundary intentionally cannot authorize it.

## Synthetic verification

`tests/pregame-feed-contract.test.mjs` covers approval/provider/purpose/audience/expiry holds, exact game and team IDs, duplicate mappings, goalie positions, stale/future/live timing, missing announcements, incomplete lineups, conflicting scratch/out reports, absent-data behavior, unknown fields and immutable inputs. The synthetic approval object is explicitly a test fixture and does not authorize any real source.
