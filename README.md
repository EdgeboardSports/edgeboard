# Edgeboard

Private NHL analytics research project with player-prop and game-market models, price comparison, ranked research candidates, and paper-testing tools. Model estimates are experimental; paper results are not evidence of future performance.

## Current development decision — October 27, 2026

Zero Trust activation is deferred. Continue development with the existing access hold and collection pause in place. No billing authorization, subscription activation, public reopening, or provider-feed enablement is part of this decision.

The application denies access when its private authentication configuration is missing. This is a code-level hold, not proof that every production or older deployment URL is protected. Cloudflare account settings, older deployments, and repository visibility still need separate attention. See [security status](docs/security-status.md) for remaining limitations and release requirements.

## Offline development

Use Node.js 24 or newer. No npm dependencies are required.

```sh
npm test
```

The default suite uses mocked inputs and synthetic test cases to exercise models, immutable pregame records, grading, candidate ranking, research context, authentication, and provider quota controls. It does not require live feeds or production credentials. Keep new tests similarly offline while collection is paused.

Continue with interface improvements, model validation, and paper-tracking behavior using synthetic fixtures or data whose use has been approved. Keep synthetic examples clearly labeled and separate from real performance records. Do not run live-provider checks or capture scripts as part of this workflow.

## Deployment

Cloudflare Pages is the current target. Its handlers live in `functions/api`, and the root middleware applies authentication before serving intended pages and APIs. Legacy Netlify handlers remain in the repository; their presence does not establish that any old deployment is protected.

`npm run build:private` prepares an explicit asset allowlist in `dist`. Do not activate that output in Cloudflare until private access and Pages **Fail closed** have been verified, as described in the security status. The output includes research data that requires those protections.

Do not add an authentication bypass to preview the interface, re-enable scheduled collection, or put credentials into source. Before restoring live use, verify private authentication and anonymous denial on every retained hostname, configure provider quota controls, and resolve provider permissions. Private access can use a reviewed alternative to Zero Trust; this project does not yet implement one.

## Research modules

- Player shots model: [model notes](docs/shots-model.md).
- Game moneyline, puck-line, total, and regulation markets: [model notes](docs/game-model.md).
- Paper capture and grading: [paper-testing notes](docs/paper-testing.md).
- Goalie, scratch, and game-day context: [research notes](docs/game-day-research.md).
- Provider integration and remaining setup: [odds provider](docs/odds-provider.md) and [security status](docs/security-status.md).
