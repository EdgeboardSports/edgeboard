# Model B selection audit — 2026-11-08

Tracks #10; executable proposal in `model-b-repair/`; draft PR #11. Production unchanged.

## Confirmed production identity

Private Site version 97, deployment `appgdep_6af073e5f2248191889570f0ab357fb2`, succeeded from source commit `ed6b64089ec84f4c07ccdd3faf06abc78dca2659`. GitHub main is an older, separate source tree. Active primary B uses `factor-b-v2` in `worker/shadow-factor-model.js`, not the older goals-v1 lab or scorecard. The route passes through late-odds/operations wrappers and a top-level independent-odds fallback in `scripts/build-collector.mjs`. V3 is separate research.

## Evidence and causes

Read-only atomic evidence-table export at 2026-11-08 22:55:16 UTC (5:55:16 PM ET), 670 rows. The private detailed report retains per-opportunity original/corrected decisions and source references; raw source payloads are not committed to this public repository.

All 16 saved B2 runs since November 4 were reconstructed with the same as-of inputs: 120 repeated game evaluations, of which 36 were capture-phase evaluations. All original decisions and values matched within 1e-12 numeric tolerance; 3 runs were byte-identical. Differences were floating-point last bits, not threshold crossings. No future evidence or results were used as model inputs.

| Capture-phase finding | Evaluations |
| --- | ---: |
| Optional-factor holds only | 14 |
| Critical validity holds (possibly also optional) | 10 |
| No data holds | 12 |
| Failed at least one existing value threshold | 34 |
| Passed value but rejected solely for optional goalie data | 1 |
| Passed value but correctly blocked by critical data/time checks | 1 |

The sole optional-only value pass confirms a real lost opportunity. The zero-pick record is not entirely explained by that bug: most candidates genuinely failed existing value tests. Eleven B2 probability forecasts existed, but none had `primarySelected:true`. Five v3 research forecasts also had no primary selections. All B forecasts are intentionally outside Model A's official ledger (`officialSelection:false`).

## Confirmed implementation defects

1. `buildShadowFactors` appended mandatory goalie-confirmation and situational-input holds. Those optional considerations were hard selection prerequisites.
2. `opsReadiness` inherited the holds and also required recent factor refresh before odds retrieval. This can prevent an eligible fresh-price check. No saved `shadow-readiness-v1-runs` rows existed in this snapshot, so the frequency of this causal path is unverified.
3. `factorShadowEvaluate` consumed Model A's `officialBoard`, coupling candidate construction and data gates. B did not filter only A's selected bets, but it lacked its own board and was odds-centric; unpriced scheduled games did not enter the primary evaluator.
4. A nonqualifying forecast used the same permanent event ID as a later qualifying selection. The duplicate guard prevented upgrading a no-bet evaluation. Confirmed by code and regression reproduction; no claimed historical lost selection from this mechanism.
5. No persistent top-three research ranking existed. Generic no-bet explanations did not identify each failed value condition.
6. Optional malformed/nonfinite inputs needed explicit finite-value handling; the proposed path fails safe on critical invalid values while isolating unsupported optional inputs.

## Proposed repair and validation

Versioned B4 implementation preserves legacy code and append-only history, retains the existing trial, separates research reports from selections, evaluates the connected schedule independently, and keeps existing numeric thresholds/weights. Unknown optional factors are explicit rather than fabricated.

Historical replay changes capture-time qualification from zero to one, with five capture runs providing at least one valid ranked candidate. This is a counterfactual diagnostic result, not a retrospective paper bet or profitability result. The known stale/in-progress value pass remains rejected.

Checks completed: existing GitHub `npm test`; private-source default `npm test`; legacy shadow, factors, late odds, v3 details and operations suites; new probability/threshold/fallback tests; new no-bet-to-selection, cap, repeat-request, grading, integrity and auth tests; compiled Worker routing tests; Worker build and syntax check. Protected Model A source/hash and Vibes-related assets remain unchanged. Replay verifies the evidence table is unchanged.

## Limits

- Coverage is every saved run available in the export, not proof every intended scheduled task ran. V1 runs, v3 forecasts, slate assessments and notifications are retained separately in the private report. No unsaved historical evaluations or source announcements were invented.
- Historical sources contain legitimate quote freshness, event-state, cutoff and coverage failures. No retrospective acquisition can make a stale quote valid at the original decision time.
- Recent-performance/replacement effects without supported coefficients remain context-only; injury/rest use existing stress effects. No profitable or calibrated-model claim is established.
- Legacy ablation/v3 diagnostics remain tied to their existing versions.
- UI browser rendering and future hosted scheduled execution/device delivery are not yet verified. Production approval and post-deployment verification remain necessary.
