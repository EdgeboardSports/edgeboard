# Player and quote verification update

Shots shortlist checks now require a matching player ID on the official NHL current roster for the verified matchup team. Roster evidence must be no older than ten minutes; unavailable, mismatched, future-dated or stale evidence prevents qualification. Best Picks, the props lab and new paper snapshots share this requirement. Paper snapshots preserve roster evidence without rewriting existing forecasts.

Roster membership does not confirm game-day availability, injury status, line combinations or power-play assignment. Those inputs remain unmodeled. A passing shortlist is experimental research, not a validated edge.

The paper collector selects the highest fresh valid decimal quote per selection before freezing shots and game markets. Undated quotes, quotes older than fifteen minutes, future timestamps beyond one minute and invalid prices are excluded. Existing snapshots are preserved.

Validation: shots-model, best-picks, paper-test, game-model, game-paper and verification test scripts. Regression cases cover missing/mismatched/stale roster evidence, roster endpoint failures, stale higher prices and collector integration.
