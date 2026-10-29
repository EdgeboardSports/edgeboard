# Private odds evidence extension: source review and implementation contract

Status: design complete; real-data integration held. Reviewed main at 2716a8fa1e53770f6c2dad8963c0e18a79fa4bc2.
This review changes no access policy, storage, feed flag, model or deployment.

## Scope and evidence

Reviewed hosted-prediction-ledger.mjs, prediction-ledger-schema.mjs, hosted-evidence-store.mjs, hosted-closing-store.mjs, historical-odds-ledger.mjs, collector-access.js, access.js, Pages middleware and build-private.mjs.
The private receiver implementation is outside this repository. Its deployed authorization, database triggers, encryption, backup/restore, tenant isolation and runtime flags were not independently verified in this review. Prior documentation is a claim to verify, not a substitute for current receiver source.

## Existing guarantees and limits

- Hosted adapters use a fixed HTTPS origin, injected bearer credentials, manual redirects, bounded timeouts and digest/readback acknowledgments. Prediction restore checks canonical snapshots, grade-chain continuity and derived settlement materialization.
- Pages authenticates intended routes and denies source/raw paths. The collector credential is GET-only and route-scoped; it must not become a ledger write credential.
- Prediction normalization freezes the chosen price/book/provider update timestamp, model inputs, model/source version and training cutoff. It does not preserve all competing quotes, their receipt times or license provenance. Player points are not supported by this existing projection.
- The closing store is a separate post-prediction observation path. It cannot establish which quotes existed before a prediction.
- Research recordedAt is caller supplied. Chain hashes cover content but cannot prove server receipt, protect against whole-chain replacement or establish source rights.
- Hosted client verification does not authenticate server receipt timestamps; those fields are outside the payload digest. Never infer pregame availability from a client-selected timestamp or successful round trip.
- data/paper-ledger.json is a legacy GitHub-backed projection. Neither it nor public Actions artifacts are destinations for new private predictions or licensed quotes.

## Extension contract (not deployed)

Reuse the private companion's authenticated storage boundary after reviewing its receiver source. Add a separate versioned odds-research namespace; retain current prediction and grading APIs without migration or reinterpretation.

Each quote envelope must contain schemaVersion, scope (synthetic or licensed-historical), provider, sourceDatasetId, approvedRightsReference, eventId, optional playerId, market, period/settlement rules, side, line, bookmaker, decimal price, providerUpdatedAt and observedAt. Store decimal as a finite number greater than one. Validate exact identity, allowed market/side combinations and bounded strings; reject unknown keys, credentials and unbounded payloads.

The server adds owner/tenant identity, receivedAt, monotonic sequence, previous digest and canonical payload digest. Ignore/reject caller receipt timestamps and owner claims. Scope must agree with authenticated rights and storage namespace. Use an atomic insert with unique idempotency key: identical retry returns the original receipt; conflicting payload returns conflict. Corrections append references and never overwrite. Reject missing auth, cross-owner reads, unsupported markets and disabled writes before any mutation.

Prediction envelopes reference exact quote IDs and model/source version. At forecast creation require quote observation and authenticated receipt no later than prediction receipt, both before scheduled start, plus explicit quote freshness. Atomically persist the forecast and its evidence references before reporting capture success. Preserve source data cutoff separately from ingestion time.

Historical imports need a distinct claim: a newly imported quote cannot be represented as an Edgeboard capture from the past. Record importedAt (server time), sourceObservedAt and provenance/rights separately. Label reports retrospective replay unless independently timestamped source archives establish contemporaneous availability. Do not bypass pregame receipt checks by backdating server receipt.

Settlements append official source/time and previous correction digest. As-of reports include only evidence and corrections received by cutoff. Match event/player/market/period/rules/side/line/book exactly; reject ambiguous matches. Show pending, void, excluded and unmatched counts independently. No outcome enters model fitting or quote selection for that forecast.

## Storage and authorization acceptance criteria

Before enabling real writes, inspect current receiver source and verify:
1. Owner identity comes from verified authentication; unauthenticated and cross-owner requests fail closed for reads, lists and writes.
2. Server clock/sequence assignment, atomic append/conflict handling, bounded pagination and separate synthetic namespaces work under concurrent requests.
3. Ordinary runtime role cannot update/delete evidence. Administrator rewrite risk is disclosed; chain heads are periodically anchored outside the writer's control.
4. Storage encryption, retention/source-license restrictions, backups and a tested restore preserve sequence and externally trusted heads.
5. Private responses use no-store; no source records or credentials enter GitHub, public artifacts, frontend bundles, logs or error messages.
6. A separate disabled-by-default write gate is used; existing collection and provider approvals remain independent. Access/storage changes need explicit approval before execution.

## Verification completed

Five existing local suites passed: hosted-prediction-ledger, hosted-evidence-store, historical-odds-ledger-dashboard, security, collector-access.
They exercise credential isolation, no redirects, canonical digests, persistence-before-grading, tamper detection, quote receipt ordering, as-of settlement, synthetic-only rendering, signed access claims, route restrictions and fail-closed provider holds.
These are mocked/local source tests, not production storage or account verification.

## Next executable task

Locate and inspect the private companion receiver source. Add receiver-side synthetic contract tests for authorization, trusted receipts, idempotency/concurrency, cross-owner isolation, correction/as-of behavior and disabled live writes. Only then implement the private odds namespace and authenticated UI. Real odds ingestion remains blocked until source rights and durable storage controls are verified. Do not rebuild the evaluator, publish fabricated performance as real, or unpause collection.
