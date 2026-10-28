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


## Private pregame evidence journal

The collector CLI now requires `EDGEBOARD_EVIDENCE_PATH`, an absolute SQLite database path outside the repository, in addition to the existing collection approval flag. This is a local collector-host path, not a browser value or a Cloudflare secret. No database has been provisioned in production, and the scheduled workflow remains paused.

The journal persists pregame context before an odds request, uses full SQLite synchronization and owner-only file permissions, and forbids updates/deletes through triggers. Each entry contains a SHA-256 chain link. Identical observations are idempotent; a conflicting observation at the same event/time/phase fails. Reopening verifies the chain. Storage failure stops the capture instead of silently losing evidence. Schema fields are allowlisted: no arbitrary headers, credentials or provider response payloads are written.

`node scripts/evidence-report.mjs /absolute/private/evidence.sqlite` checks an existing journal and prints coverage/integrity counts without player details or credentials. Collector observations contain `goalieEvidence: null` until an authorized quality source is implemented; starter snapshots alone cannot validate the goalie challenger. Observations from different capture phases must not be mistaken for independent games.

This supplies a storage adapter, not a hosted durable service. The private collector host must retain and back up the database before a prospective program starts. A hash chain detects inconsistent contents but does not provide an independently trusted timestamp or prevent an administrator from replacing the whole file. Existing Git-tracked forecasts were not migrated, collection was not enabled, and no credentials or account settings changed.


## Verified hosted storage companion — October 27, 2026

The existing owner-only preview now has a managed private D1 collector companion at https://edgeboard-research-preview.speedystone18.chatgpt.site/collector (Site project appgprj_6ae0acd669388191b7b30615f3e57a7c, source commit 794692be907e5ea2338732970b22bd9f88b4d8eb). Sites confirmed successful deployment and the DB/collector_evidence binding/table. An authenticated synthetic self-test was written, read back through the service API, and independently verified through the database reader. Anonymous API requests returned 401. The test namespace is separate from predictions.

This supersedes the earlier statement that no hosted storage was provisioned. Local SQLite collection and this managed D1 companion are separate adapters; live ingestion into the companion is still disabled. No live feed or collection schedule is enabled. The production Edgeboard diagnostics endpoint requires app authentication; the attempted secure app sign-in was rejected. Verify source access and a real pregame writer before scheduling collection. No password or service credential is stored in these notes.


## Production quota binding configured

The private setup verified the production SECURITY_DB binding and security_usage, provider_state, and security_events tables. A production redeployment is required to apply the binding. Provider balance initialization, budget-period configuration, and feed activation remain outstanding; no balance is assumed and no odds requests are authorized by this change.


## Hosted collector transport

The collector can select the fixed owner-private storage companion using EDGEBOARD_STORAGE_TOKEN supplied by its private host. Do not put this credential in Git or the browser. Local EDGEBOARD_EVIDENCE_PATH remains supported. The adapter normalizes evidence using the same field allowlist, rejects redirects, performs one POST, and requires a matching SHA-256 digest plus persisted/readBack acknowledgment. Refusals stop that event before odds requests. Live /collector/api/evidence remains disabled; this is tested transport wiring, not activated ingestion or a configured unattended credential. The existing synthetic hosted test does not validate real pregame ingestion.

## Hosted receiver and synthetic end-to-end verification

The owner-private companion receiver validates the same normalized evidence schema, limits requests to 64 KiB, requires recent pregame timestamps, preserves append-only storage, and rejects conflicting payloads for the same event/time/phase. Live evidence POSTs remain disabled unless the separate LIVE_EVIDENCE_APPROVED runtime flag is explicitly configured after source review. No such flag was enabled.

The collector's explicit synthetic transport mode uses /collector/api/synthetic-evidence and the synthetic-pregame namespace. It is not selected by the collection CLI. The deployed receiver was tested with the actual Node collector adapter: successful write/readback, duplicate detection, conflict rejection, original hash preservation, and rejection of live writes were all verified. These are synthetic transport checks, not real predictions or an activated 30-day trial. Unattended authentication is still unconfigured.
