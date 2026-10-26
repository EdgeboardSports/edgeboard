# Game-day research context v1

Best Picks, the player-prop lab, and new automatic paper snapshots now retain game-day evidence. Existing forecast snapshots are never rewritten.

## Sources and identity

The official NHL club schedule verifies the team ID, completed regular-season games, and last team appearances. Official NHL statistics provide shots for/against and skater total/power-play time on ice per game. Same-day and future game statistics are excluded. Current-season data is used; missing or short samples remain explicit.

ESPN team rosters supply injury/status reports. The normalized team abbreviation must match; source timestamps must be within one hour and not more than one minute in the future. Player names must have exactly one normalized match within the verified team. No report found is not a declaration of health or a confirmed lineup. Unknown or stale injury evidence blocks shots shortlist qualification. Reported injuries/statuses also block qualification pending review.

## Role and matchup checks

Total and power-play ice time compare the last three appearances with up to ten preceding appearances (minimum five). Total-time changes require at least 25% and two minutes; power-play changes require at least 40% and 45 seconds, including changes from a zero baseline. These fixed exploratory thresholds flag role instability in either direction; they were not tuned against results. Material changes block shots shortlist qualification.

Missing both of a team's last two completed games produces an absence flag, not an inferred injury diagnosis. Rest counts full calendar days off before the matchup; a previous-day game is a back-to-back. Last-ten shots allowed and available sample counts appear as research evidence.

Confirmed starting-goalie, game-day scratch and lineup feeds are not connected. They remain explicitly unconfirmed. Role/matchup evidence does not alter shots-v1 or goals-v1 probabilities. Applying a numerical adjustment requires a versioned model and historical as-of testing; descriptive statistics must not be presented as a validated model upgrade.

## Interface and tracking

Pick cards show availability and explain the role/matchup evidence under Evidence & checks. Best Picks remembers the selected sportsbook locally on this device and restores it when that book has quotes in a later scan. The performance ledger displays distinct sampled and graded games in addition to correlated selection counts. Model/market filters remain available. Closing-line value tracking is not part of this change.

## Validation

Run the existing shots, ranking, paper, game and verification tests plus tests/research-context.test.mjs. The new suite covers source/player mismatch, stale or missing reports, injury flags, TOI/PP thresholds, recent absences, rest days, target-date exclusion, source failures, unique game counts and shared request caching.
