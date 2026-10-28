# Performance and trial mobile browser checks

Chrome responsive same-origin iframe QA, October 28, 2026. Frame widths 320, 390 and 430 pixels; height 844. Populated pages use classic vertical scrollbars, leaving 305/375/415 pixels of content width. Empty pages without a scrollbar use the full frame width. All data and SQLite journals were local synthetic fixtures; provider requests were disabled. No production secrets or records were used.

Verified main Performance's nine scorecards, expanded five-row calibration, empty history, market selection and future-cutoff rejection. The preview empty-ledger fixture lacked schemaVersion and now includes version 1. Main refresh failures now clear previous metrics/tables/ledger-derived status instead of leaving stale results. Independent static research scorecards remain visible.

Verified private Performance's live-empty default, synthetic three-record dataset, filters, insufficient-evidence state and clearing after an invalid future cutoff. Fixed the narrow datetime control overflow, implicit extra grid column caused by wide buttons/text, and intrinsic grid widths from market/model tables. Filters are now one column on phones; tables scroll inside their containers. Final pages show no viewport overflow at any tested width.

Verified private trial's not-configured state, synthetic 30-day operation table, eight grading cards and unavailable-after-populated state. Invalid capture-day requests hide the report and clear the previous table/cards. Added a focusable, labelled table-scroll region and visible horizontal-scroll hint. At 320 pixels, the table's container is 227 pixels wide with 815 pixels of content; ArrowRight after focus changed scrollLeft to 51 without page overflow.

The JSON records initial/intermediate failures as well as final successful checks. Final private-Performance cases are named private-performance-verified. This is browser layout/interaction QA, not production authentication, physical iPhone/Safari, device zoom, screen-reader certification or live-trial validation. Actual iPhone/Safari testing remains outstanding.

Full main/private unit suites, main production build, Worker build and artifact validation passed. Preview harnesses are development-only; no production API, source, authentication or activation gates were changed.
