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

## V21 phone usability pass

Shared styles now use 16px mobile form text (including player controls), 48px inputs/buttons, 44px disclosure/link targets, and larger checkbox targets. At 320px, filters and player controls stack into one column; larger phones retain two columns. The optional performance UTC cutoff spans both columns. Long names, statuses and selections wrap instead of widening the document. Table cards retain readable field labels and horizontal overflow stays inside its container when a table has not yet been decorated.

The five-item bottom navigation is now a CSS grid with safe-area padding and a distinct Best Picks icon. The injected navigation font override was removed. Matchup tabs remain accessible below the sticky top bar. Nonembedded pages have a keyboard-visible Skip to content link targeting focusable main content; embedded tools retain their compact shell. Shared asset URLs are consistently revised to v21 to avoid mixing cached shell versions.

`npm run dev` starts an isolated synthetic preview server; it never calls a provider. Only intended app assets and the two UI fixtures are served; source/configuration paths remain unavailable. API responses deliberately show paused/unavailable feeds and empty saved history. `tests/ui/mobile-preview.html` supports Today, Best Picks, Matchup, Props, Players, Performance and synthetic component screens at 320, 390, 430 or 1180px iframe widths. Synthetic content is prominently labeled and is excluded from the production asset allowlist.

Verification: all existing tests and the production asset build pass; shared JavaScript syntax and the preview helper's routing/no-provider behavior were checked. Cloud-browser visual inspection was blocked by an access-policy error after the initial preview connection failed. No successful screenshot, iPhone/Safari device test, zoom measurement or rendered overflow assertion is claimed. Source-level checks do not replace that remaining visual verification. Production models, authentication, provider routes, source gates, budgets and stored predictions are unchanged.

## V22 rendered mobile verification — October 28, 2026

This supersedes V21's blocked-browser verification limit. Chrome successfully rendered the actual Today, Best Picks, Matchup, Props, Players and Performance pages plus the synthetic table/control fixture at 320, 390 and 430px iframe widths. All 21 checks loaded asset revision v22 and had document scrollWidth equal to clientWidth. The browser's classic vertical scrollbar consumes 15px, leaving measured content widths of 305, 375 and 415px. The matrix is recorded in docs/qa/mobile-v22-checks.json. A 1180px desktop fixture also had no horizontal overflow.

Visual inspection found clipped two-column filter values and an awkwardly wrapped Performance navigation label. Phone filters and player controls now stack through 480px; the bottom tab displays Results while retaining the Performance accessible name and route. The preview reports its actual frame width and uses an explicit QA revision plus no-store responses to avoid validating stale cached pages.

Browser interaction checks passed for player Analyze failure handling, matchup tab selection and arrow-key navigation, checkbox selection and disclosure expansion. Player inputs/selects/buttons measured 48px or taller (checkbox controls remain 24px inside larger labels). The long-name table fixture wraps within its card.

A failed game feed previously left Loading matchups and a blank 500px tools frame visible indefinitely. The Matchup screen now shows a disabled unavailable/empty selector and a clear tools-unavailable message while hiding blank frames. Props similarly clears the loading selector and disables requests on failed/empty discovery; selecting a valid available event enables manual loading. Regression tests cover failed, empty and valid discovery and verify that discovery never automatically requests odds.

These checks used local held/synthetic feeds and no live odds requests. They cover browser-rendered responsive layouts and selected interactions, not a physical iPhone, Safari keyboard/zoom behavior, a loaded live-price slate or every model-result state. Models, authentication, source permission gates, provider budgets and stored predictions remain unchanged.
