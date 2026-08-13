# CapacityIQ

A React SPA for engineering resource planning — maps headcount supply (engineers and their allocations) against project demand across a 5-tier discipline org hierarchy, with a swimlane grid view, people/org-chart view, analytics, and a change log.

This is a personal copy of a tool I built for internal use at a previous job. It has been stripped of company-specific data and identifiers (employee records, org data, internal deploy tooling). See `CLAUDE.md` for full architecture and data-model notes.

## Stack

- React 18 (loaded as a global, no bundler-managed import)
- esbuild — bundles `src/app.jsx` into a single self-contained `dist/index.html`
- No backend included — see "Persistence" below

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

The app currently reads/writes state via `fetch` calls to `/vibes/store/...` — a proprietary internal hosting API not included here. Out of the box this copy has **no working backend**; the UI will load but nothing will persist. To use it for real, swap those calls (in `src/app.jsx` and `src/components/StoreDataModal.jsx`) for your own storage — localStorage for a quick demo, or a small REST/DB service for something durable.
