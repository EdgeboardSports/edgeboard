# Pregame goalie and scratch feed

## Sources and status

The NHL game landing verifies game ID, teams, date, game type and start state. ESPN scoreboard probableStartingGoalie entries provide explicit statuses. Only status.type=confirmed becomes Confirmed. Expected, probable and projected become Projected. Missing, ambiguous and unrecognized statuses remain Unknown. Player names, jersey numbers and goalie positions must map uniquely to an official current NHL goalie roster ID, and the ESPN athlete team must agree with the matchup competitor. NHL/ESPN team-code aliases are normalized.

NHL right-rail game reports provide scratches by official player ID. A scratch blocks that player's prop qualification. An empty scratch list is unknown; it never establishes a complete confirmed lineup. The right-rail season series must include the requested game with matching home/away identities.

Only same-day future/pre-game events are queried for confirmation. The source's game must match both sides and start within fifteen minutes of the NHL schedule. Server results are cached for sixty seconds; client evidence expires after three minutes or when the earlier verified start time passes. Failures discard the old confirmation during refresh. The displayed checked timestamp is retrieval time, not announcement time; ESPN does not provide a confirmation publication timestamp in this response.

## Screening and refresh

Game-bet candidates now require fresh confirmations for both starting goalies. This is a qualification check, not a goalie-specific probability adjustment. Shots candidates are blocked by published scratches; unconfirmed full lineups remain visible. Existing injury, roster and role-change checks still apply.

Best Picks refreshes goalie/scratch evidence every minute while open, with one request per distinct NHL game and without requesting paid odds. The props lab and game-market pages also refresh these reports every minute. New paper captures freeze the evidence and game-day-v1 rule marker. Existing snapshots stay unchanged. Closed pages do not run browser timers; the existing paper-test workflow continues its scheduled captures.

## Limits

This does not connect a full projected skater-line/confirmed dressing-list feed. It does not interpret absent injury or scratch reports as clearance to play. A third-party Confirmed label is provider-reported, not a guarantee against a late change. No estimated probability is increased or decreased from goalie data until a versioned model and historical as-of evaluation support doing so.

## Validation

npm test includes tests/game-day.test.mjs: explicit confirmed/projected status, NHL identity and jersey matching, duplicate-name rejection, future/stale/live evidence rejection, official scratches, strict game-bet gating, deduplicated refresh requests, source failures and endpoint integration. Existing model, paper and context suites also run.
