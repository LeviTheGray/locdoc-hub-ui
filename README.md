# locdoc-hub-ui

Shared UI + logic for the **LocDoc Employee Hub**. This repo is the **source of truth** for:

- **Design tokens** (`src/tokens.js`) — the brand palette, card/icon/button/header patterns,
  previously copy-pasted into every custom element.
- **Pure scoring logic** (`src/scoring-core.js`) — the scorecard math (measurables, blended
  composite, monthly streak, levels). No Wix APIs; runs in plain Node and the browser.
- **Web components** (planned) — the vanilla custom elements (`hub-home`, `my-reports`, …)
  lifted out of the Wix repo so they can be reused untouched.

## Consumers

1. **teamwix** (the Wix site) — Wix git-sync needs files physically under `teamwix/src/`, so it
   can't `npm install` this package. Instead, **generated copies** are written into teamwix by
   `scripts/sync-to-teamwix.mjs`. Edit sources here → run the sync → commit teamwix.
2. **Standalone hub app** (POC, separate repo) — a Vite static app that imports these modules
   directly and feeds the components data from the Wix Data REST API.

## Commands

```bash
npm test              # node --test tests/  — runs the scoring-core reference tests
npm run sync:teamwix  # write generated copies into ../teamwix (or $TEAMWIX_PATH)
```

## Status (Phase 0)

- [x] `scoring-core.js` extracted + tested; synced into teamwix as a generated copy.
- [x] `tokens.js` established as the canonical look.
- [ ] Validate whether Wix custom elements can `import` a shared module at runtime. If not, the
      sync script inlines `tokens.js` into each generated element copy.
- [ ] Lift the web components here and compose them from `tokens.js`.

See the roadmap in the teamwix planning notes for sequencing (Phase 0 → parallel workstreams).
