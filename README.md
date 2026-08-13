# CapacityIQ

A React SPA for engineering resource planning — maps headcount supply (engineers and their allocations) against project demand across a 5-tier discipline org hierarchy, with a swimlane grid view, people/org-chart view, analytics, and a change log.

This is a personal copy of a tool I built for internal use at a previous job. It has been stripped of company-specific data and identifiers (employee records, org data, internal deploy tooling). See `CLAUDE.md` for full architecture and data-model notes.

## License

Shared publicly for reference and portfolio purposes only. All rights reserved — no license is granted to copy, modify, or redistribute this code, in whole or in part, without my prior written permission.

## Stack

- React 18 (loaded as a global, no bundler-managed import)
- esbuild — bundles `src/app.jsx` into a single self-contained `dist/index.html`
- No backend — data persists to browser `localStorage`, see "Persistence" below

## Setup

```bash
mkdir -p tools
# macOS arm64:
curl -fsSL https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-0.25.4.tgz \
  | tar -xz -O package/bin/esbuild > tools/esbuild
chmod +x tools/esbuild
```

(Swap the package name for your platform if not macOS arm64 — see [esbuild releases](https://www.npmjs.com/package/esbuild).)

## Build & dev

| Command | What it does |
|---------|---------------|
| `./build.sh` | Compile + bundle → `dist/index.html` |
| `./dev.sh` | Watches `src/` and `index.html`, rebuilds on change (requires `fswatch`) |

## Persistence

There's no backend — state persists to the browser's `localStorage` (see `loadLS`/`saveLS` in `src/app.jsx` and `src/components/StoreDataModal.jsx`). On a brand-new browser with nothing saved yet, it seeds a small fictional demo org (`buildDemoSeed()` in `app.jsx`) instead of starting empty, and shows a "Demo Mode" banner. To back this with something durable — shared across devices/users — swap `loadLS`/`saveLS` for calls to your own REST/DB service.
