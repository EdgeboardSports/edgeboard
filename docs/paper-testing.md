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

## Hosted private forecast and grading ledger

The collector now supports an append-only private ledger in the owner-only companion, alongside context evidence. Predictions retain an allowlisted projection of selection/event identity, frozen price/book/quote time, capture/start times, production model version/source commit, forecast and baseline distributions, numerical model inputs, qualification checks and training cutoff. Larger lineup/research context remains separate event-linked evidence. This projection is intentionally separate from the original full public snapshots; no legacy records are silently migrated.

Grades are separate append-only events. Each references its prediction and the previous grade hash. Idempotent retries are recognized; conflicting forecasts, changed child grades and stale correction branches are rejected. Flat-unit returns are derived from the frozen quote rather than trusted caller units. Readback verifies snapshot/grade hashes and chain continuity. Cutoff reads require both grade time and server receipt time to precede the cutoff. Pagination supports restoring private records after a collector restart. Hashes detect inconsistency; they are not independently trusted timestamps or protection against an administrator replacing the database.

The hosted schema uses existing append-only collector_evidence storage with separate paper-live and paper-test prediction/grade namespaces and indexed lookup. The production CLI requires private hosted storage and a verified source commit. It restores private records, persists predictions before adding them to local state, and persists grades before updating settlements. It no longer writes new forecasts or grades to data/paper-ledger.json. The old saved public history and existing dashboard remain unchanged. Checkpoint/run heartbeat metadata and dashboard integration with private history are separate follow-ups; the 30-day evaluation has not started.

The live prediction write route remains disabled until LIVE_LEDGER_APPROVED is explicitly configured after source review, independently of the context-evidence hold. No feed flag or schedule was enabled. The synthetic self-test CLI takes Sites service access through protected stdin and exercises the actual hosted adapter: save/readback, duplicate, conflict, correction, cutoff and fresh-instance restore. Test records never enter live namespaces or performance results. Both repository and companion test suites cover these paths, including local database reopen, immutable triggers, pagination, failed persistence before grading and refusal to write the public ledger.

## Private performance dashboard connected

The Performance page now links to the owner-only collector dashboard at /collector/performance. It reads verified private ledger history with live/test namespace separation, market/model/qualification filters, UTC windows/cutoffs, flat-unit paper outcomes, baseline Brier/log loss, calibration, cohort summaries and preserved grading revisions. The old saved archive stays available. Missing live captures remain an explicit empty state. Scheduled collection/grading remains paused; no prospective trial was started.

## Protected closing-price capture and CLV proxy

The collector now has a final-15-pregame-minute closing phase for already-frozen shots and supported game-market predictions. It first checks private closing-write readiness, verifies the upcoming NHL matchup, resolves prop IDs through the gated player-profile route, checks protected remaining budget and atomically claims one event/market-group attempt. Only the first claim requests odds. Failed/missing quotes are not silently retried; totals and new prop markets are not acquired. Existing server-side quota reservations remain authoritative. No schedule or source flag was enabled.

Closing observations preserve the same bookmaker, event/player, market, side and line as the forecast, with price, quote time, observed time, source and server receipt. Private append-only storage rejects duplicates/conflicts and forbids live poststart backfill. LIVE_CLOSING_APPROVED is a separate disabled gate. Synthetic checks use an explicit fixture source and separate namespace. No test value enters live reporting.

The dashboard reports matched/recorded coverage and frozen-price/last-observed-pregame-price minus one. Positive means better frozen price. Missing observations remain unknown. Report cutoffs include both observation and server receipt times. This is an observed final-window closing-price proxy; it is not a certified final market close. Cached prices/provider delays and correlated selections remain limitations. Actual prospective collection and closing coverage have not started.

## Fixed prospective trial protocol and durable operations journal

The private `/collector/api/trial` service stores immutable 30-day protocols in live/synthetic namespaces, including UTC midnight start, hourly cadence, 15-minute start grace, model versions, market list, source commit, 1-unit paper stakes and two-game sampling cap. Editing a protocol ID conflicts instead of restarting its clock. A planned protocol does not start a trial. Live activation additionally requires approved runtime source/storage/closing gates, a fresh successful source/quota audit, verified scheduler configuration, and a real privately saved capture with a settled grade. Those activation prerequisites remain unmet; no live protocol or schedule was created by this change.

Each hourly run atomically claims a private start record before any source access. Only the insert winner may collect. An append-only completion references its exact start digest and records success, held or error counts for captures, new predictions and grade changes. Storage failure stops collection or leaves a visible unfinished start; duplicate/late slots never trigger a replacement provider request. A lost response after claiming deliberately prevents retry rather than risking duplicate collection. Local runner heartbeat history is no longer the only operational record. The collector CLI requires `EDGEBOARD_TRIAL_ID` and the frozen matching code/model/market protocol in addition to its existing approval and credential requirements.

`npm run report:trial -- TRIAL_ID [AS_OF_UTC] [CAPTURE_DAY_UTC]` reads the owner-private journal with the Sites service credential supplied only through protected JSON stdin. The report verifies journal hashes and start/completion links, applies server-receipt cutoffs, lists all 720 expected slots after activation and distinguishes missing, unfinished, held, failed, successful and not-yet-due slots. It contains 30 daily UTC operations rows and a selected capture day’s private grading/performance report for every frozen model/market pair, including grading corrections and closing coverage. Grade changes by run day are processing counts; performance cohorts are grouped by capture day at the selected cutoff, not a historical bankroll curve.

The private ledger remains the source of frozen forecasts and grades. Reports recompute from immutable records at an explicit cutoff; no credentials or real prediction records are committed to Git. Elapsed windows, zero-capture successes and passing synthetic checks do not certify collection completeness, a no-game day, accuracy or profitability. Synthetic test protocols/runs cannot enter live results. No automatic wagers, paid sources, live activation or recurring collection were enabled.

Trial results additionally require an exact frozen trialId on each private prediction. Existing untagged forecasts and captures assigned to another trial are excluded, even if their dates/models match. The optional allowlisted projection field leaves old records and hashes unchanged; no legacy records were retagged.

Hosted synthetic verification passed on October 28, 2026: protocol/write readback, durable slot/completion readback, duplicate suppression, eight daily model/market grading views and receipt-cutoff behavior. No real provider requests were made. A separate live-status read returned not_configured with trialStarted=false. Companion deployment succeeded with owner-only access preserved. This verification does not start or qualify a real trial.

## Daily paper risk diagnostics — October 28, 2026

The evaluation window and Performance cards now include maximum daily drawdown, worst UTC settlement-day profit, and maximum qualifying selections on one event. Returns use one unit per settled selection and the selected as-of settlement corrections. Daily closes group simultaneous/correlated results without inventing an intraday order. Initial losses count as drawdown from zero starting profit; no settled evidence displays unknown. Voids and pending records do not contribute returns. The report includes the daily cumulative return series and excluded invalid/undated settlement count. These are hypothetical exposure diagnostics, not bankroll sizing, independent wagers, or profitability evidence. No collection or provider access is enabled.

Validation: full npm test and private production build passed; synthetic tests cover input-order invariance, initial losses, pushes, empty history, same-game concentration, and settlement correction cutoffs.

## Game-grouped ROI uncertainty — October 28, 2026

Evaluation reports include a deterministic 2,000-replicate whole-game percentile bootstrap with a 95% ROI interval. Every resampled game retains all its settled selections; each replicate divides total profit by total settled stakes, including pushes. The interval requires at least 20 distinct settled games and varying game returns. This is a display threshold, not a power calculation. Empty/small/constant samples remain insufficient evidence; intervals spanning zero are inconclusive. Positive or negative intervals describe this sample only. No model promotion follows automatically.

The estimator receives already deduplicated records with the requested as-of settlements and capture filters. It never treats pending or void selections as settled, substitutes unknown game identities, or fetches data. It does not address cross-game dependence, repeated model tuning, selection bias, feed quality, or changing regimes. Main Performance and the owner-private performance API/view expose the same estimator. Tests verify clustered replication invariance, unequal stakes per game, deterministic input-order invariance, sample gates, pushes, bad identities/prices, and correction cutoffs.
