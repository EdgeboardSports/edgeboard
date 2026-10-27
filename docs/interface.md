# V19 interface

Presentation-only overhaul: shared app shell, desktop sidebar/mobile bottom navigation, Today slate, a shared matchup workspace, player analysis, and performance views.

Models (shots-model.js, game-model.js), paper-core.js/game-paper.js, sampling, grading, saved forecasts and API secrets are unchanged. Props use the existing free event feed for matchup selection instead of retrieving sportsbook odds just to populate a dropdown.

## Portraits

Existing exact-match NHL player IDs and team/season identifiers select official NHL CDN headshots. Missing images keep a neutral silhouette; an optional cached player landing lookup can provide a current official portrait. Only https://assets.nhle.com image URLs are accepted from that lookup. The profile response contains identity/photo fields, not private account data.

## Navigation and responsive behavior

- Today: official slate, saved pregame research candidates and paper-testing heartbeat. Saved quotes are labeled frozen, not current.
- Matchup: game markets and player props share an event ID. Embedded views load prices only when requested and keep their selection across tabs.
- Players: the existing analyzer moved to /player. Legacy /?playerName=… links redirect there.
- Performance: existing market filters/metrics with mobile card layouts.

Tables keep their underlying data and use labeled mobile rows. History/model details collapse on prop cards. The embed height message validates origin and source window before resizing.

## Checks

npm test includes player profile input/asset validation. Existing model/paper checks remain intact. Tests/ui/mobile-preview.html provides an unlinked 390×844 smoke-check frame for Today, Matchup, Props, Players and Performance.

Manual QA: portrait loads/fallback, name/line linking, same-event market/prop tabs, model detail expansion, mobile overflow, and performance market switches.


## Paused research and performance update

The shared research-status module reflects the checked-in collection hold. Every page shows a paused banner; Today and Performance label the last run as a historical record. The status does not claim production access is configured. Changing a heartbeat cannot turn the status live. Collection and grading remain paused.

Performance compares all frozen forecasts and passed-at-capture subsets by model version within the selected market, with distinct graded games, selections, deduplicated forecasts, model/baseline Brier, absolute Brier improvement and relative skill. Empty or pending-only samples show no accuracy score. These descriptive measures are not confidence ratings or betting returns; different versions may cover different games. Existing snapshots and grades are unchanged.

Validation: npm test (including performance-summary regressions) and npm run build:private. Browser rendering needs a separate check when a browser runtime is available.
