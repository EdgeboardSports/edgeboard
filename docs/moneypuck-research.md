# MoneyPuck offline historical import

Historical research data: **MoneyPuck.com**, https://moneypuck.com/data.htm. Its listed downloads are free for noncommercial use with clear attribution; other uses need permission. This importer is for private, noncommercial research. No raw MoneyPuck dataset is committed, served by the application, or redistributed in its public repository. No website scraping, new account, paid feed or recurring download is introduced.

## Reproduce the import

Download the regular-season goalies.csv and skaters.csv files linked by MoneyPuck's data page for the desired season. Season 2025 denotes 2025–26, not calendar-year 2025. The verified source files were:

- https://moneypuck.com/moneypuck/playerData/seasonSummary/2025/regular/goalies.csv
- https://moneypuck.com/moneypuck/playerData/seasonSummary/2025/regular/skaters.csv

Run `npm run report:moneypuck -- 2025 2026-10-28 /absolute/private/goalies.csv /absolute/private/skaters.csv`. The command reads local CSVs, performs no network requests or writes, and prints an attributed audit. `importMoneyPuck` also returns normalized per-player research rows for offline experiments. Files are bounded to 10 MiB each; required columns, season, player identity, exposure and numeric values are validated. Malformed input fails the import. Only all-situations rows are used. Exact duplicate normalized records count once; conflicting copies of a player are excluded and disclosed.

Goalie ice time is seconds and is converted to minutes. Goals saved above expected equals xGoals minus goals allowed; the per-60 value multiplies by 3,600 and divides by source seconds. Skater shots use I_F_shotsOnGoal, not unblocked attempts or expected shots. Outputs include shots per game and per 60. Missing exposure gives unknown rates, not zero.

## Actual download validation — October 28, 2026

The 2025 goalie file produced 98 all-situations player rows from 490 source rows; 71 had at least 600 minutes. SHA-256: `2fe2a2dbf25822cf1650e2ad00388c94ef303681fbfd8a8c7fdcb065212cd2fc`.

The skater file produced 940 all-situations player rows from 4,700 source rows; 715 had at least 20 games. SHA-256: `9a7e1f1a2f6bc8bc2bf10c5ba32947b47c4b26d5397287e4b30e9d662c4966e4`.

Neither file contained conflicting or repeated all-situations player records in this download. The sample thresholds describe exposure only, not model qualification or demonstrated predictive skill.

## Backtest boundaries

These are season summaries. `priorSeasonResearch` rejects target dates before July 1 following the source season's starting year. It prevents whole-season totals leaking into that season's targets. It does not prove when historical revisions were published. Every result remains researchOnly with historicalPublicationVerified=false. Team labels are historical and cannot establish a current roster.

No pregame starters, injuries, lineups, historical publication timestamps, zero-shot game logs, or target-game forecasts are reconstructed from these summaries. They do not satisfy the existing goalie backtest's archived pregame-evidence requirement and are deliberately not injected into it. The next data step for measured shots-model validation is game-level logs with explicit observation timing and complete player appearances; season-average rates alone are not a backtest. No accuracy improvement, ROI, model promotion or live trial is claimed.
