# Web Empire

We are building a web design empire based in **Reading, Pennsylvania (ZIP 19601)**.

## The brief
Six agents work in this repo.

**3 Room Builders — 3D interior rooms only.**
No exteriors, no outside scenes. Every room is nice, clean, gamer-style with a nerdy aesthetic.

**3 Local Lead Generators — Reading, PA 19601 and surrounding area.**
They find local businesses whose websites look outdated, broken, or in need of an update. For each business they research it and build a working, functional, ready-to-ship website tailored to that business.

**Joey's only job:** call the business and tell them their new website is ready.

## Workflow
**Scout → Build → Ship → Call**

See [docs/AGENTS.md](docs/AGENTS.md) for each agent's role and the full workflow.

## Status
Scaffold only (Nov 7, 2026). No lead generation or room building has started yet.

## Dashboard

The root [`index.html`](index.html) is the 3D floor, published by GitHub Pages at <https://joeypbrrr.github.io/web-empire/>.

The page only shows what is in [`data/empire.json`](data/empire.json). Rebuild that file after new commits, site folders, or lead files:

```bash
python3 scripts/build_dashboard_data.py
```

Commit the updated `data/empire.json` with the repo change. The script reads `git log`, `docs/AGENTS.md`, `sites/*/index.html`, `leads/*.json`, `leads/*.csv`, and `rooms/*/index.html`. It drops phone numbers and contact fields. Lead fields are documented in [`leads/README.md`](leads/README.md).

A room counts only when `rooms/<slug>/index.html` exists. Optional `rooms/<slug>/room.json` may set `name`, `notes`, and `agent` (`room-builder-1`, `room-builder-2`, or `room-builder-3`).

Preview links are this repo's GitHub Pages URL plus the site path. Use GitHub Pages or any static server (`python3 -m http.server`). Opening `index.html` as a file will not load the ES modules.

UI checks, Chromium and WebKit at desktop and 390×844:

```bash
npm install
npx playwright install chromium webkit
npm test
```
