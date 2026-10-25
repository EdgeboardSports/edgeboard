# V17 automatic paper testing

The hourly GitHub workflow runs independently of an open browser. It uses only Edgeboard's public read-only data endpoints. The odds key stays in the existing Cloudflare server secret; no new credential or paid subscription is installed.

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
