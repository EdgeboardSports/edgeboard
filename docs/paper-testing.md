# V17 automatic paper testing

Scheduled collection is paused. The current manual GitHub workflow reports the source-permission review hold; it does not collect predictions. Existing saved history remains readable after authentication. The odds key stays in the existing Cloudflare server secret; no new credential or paid subscription is installed.

## Sampling

At most two attempted regular-season games per Eastern day, ordered by upcoming start time. Capture only 15–180 minutes before the earlier NHL/provider start time. The free event-discovery endpoint is used between captures. A selected game requests one shots market, up to one provider credit on a cache miss; snapshots include every available best-price player/line/side estimate and failed shortlist checks. Missing data remains an exclusion. At observed quota below 100, new captures pause. Other interactive app usage also consumes credits.

Late/missed scheduler runs never backfill after start. GitHub schedules are best effort. The dashboard warns about an old heartbeat and reports run errors.

## Frozen audit record

Snapshots preserve quote, quote timestamp, probabilities, baseline, model inputs/version, code commit, shortlist checks, training end date and capture time. A digest detects snapshot modification. Git history provides an additional audit trail. Live price changes do not rewrite stored quotes. All records are public model forecasts, not personal bets.

## Grading and interpretation

Grade only final NHL games, matched by exact official game ID. Use official player shots. No appearance becomes a paper void after 24 hours; missing shot data stays pending. Recheck final results daily for 14 days, storing prior grades on corrections without changing snapshots.

Simulate 1 unit per recorded selection. Profit and ROI use frozen decimal prices. Include pushes in stake denominator; exclude voids and pending selections. Opposing sides/multiple lines are correlated alternatives. Brier/calibration deduplicate event/player/line; shortlist and all-prediction groups remain selection-biased and descriptive. No profitable-edge claim is made.

## Operations

Workflow: .github/workflows/paper-test.yml. Source: scripts/paper-runner.mjs. Ledger: data/paper-ledger.json. Scheduled commits use the Cloudflare-specific skip prefix to avoid unnecessary deployments; the ledger endpoint reads the latest committed data with a short cache. No automatic wagers or messages.

Run npm test. Tests cover capture cutoff, training-date exclusion, daily cap, quota reserve, idempotence, frozen snapshot integrity, grading and deduplicated metrics.

References:
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows
- https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
- https://the-odds-api.com/liveapi/guides/v4/


## Reports at an explicit cutoff

The 30-day dashboard accepts an optional UTC report cutoff. Blank means now; future cutoffs are rejected. The offline report supports the same cutoff: `node scripts/paper-report.mjs 2026-10-25 2026-10-26T00:00:00Z`.

Reports use only captures and timestamped grades known by that cutoff. A corrected result uses the latest eligible entry in `resultHistory`; undated settlements and a currently withdrawn/pending settlement stay unresolved. Closing observations after the cutoff are excluded, and closing value is not declared before the game starts. Missing observations remain unknown.

Exact duplicate records count once. Conflicting copies of the same captured selection are all excluded and disclosed, rather than selecting a favorable result. Daily tables group by UTC capture day with grades known at the report cutoff; they are capture cohorts, not historical bankroll curves. Elapsed window completion does not prove collection completeness or statistical significance. These calculations do not modify ledger records or activate collection.
