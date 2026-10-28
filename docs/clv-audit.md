# CLV pipeline audit — October 28, 2026

Synthetic checks cover capture, hosted-client canonical envelopes and acknowledged digests, private SQLite append-only storage/readback, and performance reporting. No real provider was called. This is code-path verification, not evidence that live closing collection is running.

Fixed three gaps:

- Same latest observation timestamp with different prices now yields unknown CLV regardless of input order. Identical duplicates remain usable; an earlier favorable quote is not selected as a fallback for ambiguous latest evidence. Main and private reports share this logic.
- Capture rechecks the earlier snapshot/NHL start after the durable claim and before requesting odds. A slow claim cannot justify starting a price request after that verified start. The once-only claim remains consumed; late collection is never backfilled.
- Shots quotes explicitly labelled as another market are excluded. Legacy shots-only endpoint rows without a market field remain supported. Exact book, player, side and line matching remains enforced.

Capture errors now use a bounded generic message, rather than persisting external exception text. Tests cover each identity dimension, stale/future quotes, post-start observations, future/malformed receipts, report cutoffs, missing observations, duplicates/conflicts, immutable inputs, earlier NHL starts, slow claims and no late provider request. Existing private tests cover live write holds, no live post-start backfill, conflicting stored quotes preserving the original, and append-only database triggers.

The reported value remains a same-book, same-selection/line observed price proxy in the final 15 pregame minutes, not a certified market close. Missing/conflicting evidence is unknown, not zero. No new market, source permission, quota, schedule, or live write gate was enabled. No wager is placed. No UI layout changed.

Validation: full main and private test suites, production build, private Worker build and artifact ESM validation passed.
