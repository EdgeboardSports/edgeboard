# Model B diagnostic and repair proposal

This is executable production-source repair code for draft PR #11 / issue #10, not a change to the older game lab in the GitHub repository.

## Source provenance

The owner-private Site version 97 was verified deployed successfully, with source commit `ed6b64089ec84f4c07ccdd3faf06abc78dca2659`. Its canonical repository is separate from this GitHub repository. Production Model B is `worker/shadow-factor-model.js` (`factor-b-v2`), reached through `shadowModelWithOperations`, `shadowWithLateOdds`, and the build-time `independentShadowCapture` wrapper. The original source is retained unchanged for historical replay.

This bundle adds `factor-b-v4` (v3 already names a different research experiment). It supplies an independent Model B board, optional factor handling, immutable evaluation reports and rankings, and a selection-only ledger. It uses the existing trial ID and end date. Existing B2 primary selections count against its cap. Model A, Vibes, authentication, the provider budget, and historical records are not modified.

## Apply and verify locally

Use a fresh checkout of the exact private production source. Do not apply to the older GitHub root. No installation is necessary for these Node 24 tests.

```sh
node model-b-repair/scripts/apply.mjs /absolute/path/to/private-checkout
cd /absolute/path/to/private-checkout
node scripts/build-collector.mjs
node --check dist/server/index.js
node tests/model-b-math.test.mjs
node tests/model-b-repair.test.mjs
node tests/model-b-routes.test.mjs
node scripts/model-b-replay.mjs /absolute/path/to/private-evidence.json /absolute/path/to/private-replay.json
npm test
npm run test:shadow
npm run test:shadow-factors
npm run test:late-odds
npm run test:shadow-details
npm run test:shadow-operations
```

The application script verifies SHA-256 fingerprints of all production Worker dependencies and touched assets before writing. It aborts on source drift. It copies the new modules/tests and makes narrow routing, build, dashboard and reporting changes. It does not push, merge, deploy, mutate live data, or change schedules.

## Resulting behavior after an approved deployment

- Existing `/collector/api/shadow-factors` GET/POST/grade routes use the corrected version, including the top-level independent-odds wrapper. `/collector/api/model-b` is an explicit alias.
- Both late refresh and B notifications use corrected B eligibility. Missing optional factors no longer stop an otherwise eligible odds refresh. Existing provider/window/budget restrictions remain.
- Every capture POST saves a versioned `shadow-b-v4-runs` report with the slate, source IDs, all decisions and ranked research candidates—even if no selection qualifies.
- The dashboard shows up to three valid pregame matchups, one side per matchup, ranked by conservative return then edge. Each includes price, probability, edge, qualification reasons and contextual adjustments. Invalid/stale candidates remain visible in the report's evaluated/unrankable lists, outside the top three.
- Only actual qualifying primary paper selections enter `shadow-b-v4-forecasts`. An early no-bet report cannot reserve a game's selection ID. The cap stays two per Eastern day, including previously selected B2 games. Repeated requests cannot duplicate selections.
- Existing v1/v2/v3 records remain intact. The v3 detail experiment and old ablation diagnostics remain legacy research; this patch does not relabel them as validated v4 diagnostics.
- `officialSelection:false` continues to mean “not Model A's official ledger.” B's own paper selections are `primarySelected:true`; research rankings have no stake and never become selections just because they are ranked.

## Unchanged modeling policy

Minimum edge 0.02, expected return 0.03, conservative return strictly above zero, two selections/day, one unit, DraftKings h2h, 50/50 baseline–market blending, rate stress ±15%, OT shares 40/60. No fitted coefficient or threshold was changed to obtain a pick.

Goalies, situational rates and supported referee effects retain existing formulas when usable. Missing/conflicting goalie quality and unavailable optional situational data fall back explicitly. Injury and rest remain declared stress scenarios rather than invented central-probability shifts. Recent form, travel and replacement-player effects without verified/calibrated inputs remain unknown/context-only. A richer validated model is a separate research question.

## Approval boundary

No merge or deployment has been performed. GitHub merge alone does not update the separate private Site source. Following approval, obtain fresh production source, reconcile any drift, apply this reviewed bundle, rerun checks, deploy through the existing private Site workflow, and verify actual scheduled writes/notifications. Do not restart the trial or backfill selections.
