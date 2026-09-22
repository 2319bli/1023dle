# 1023

A colour-circuit puzzle: match each lamp to its goal using Cycle, Reverse, Swap, and Rotate switches. Each matching lamp sets a bit, from 512 down to 1. Match all ten for `1111111111₂ = 1023`.

## Modes

- **Daily:** the same deterministic puzzle for everyone, refreshed at 00:00 UTC. No hints.
- **Practice:** unlimited randomly generated puzzles with hints.
- **Endless:** solve each circuit in the minimum number of moves plus two or fewer. Run out of moves without solving and the run ends.

Each mode saves locally in the browser. Keys **1–9, 0, Q, W, E, R** activate the 14 controls. Colours also have shape symbols.

## Play locally

From this directory:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000. This runs the offline game; use the full development server below to test shared leaderboards. No installation or build step is required for the offline game. Google Fonts are optional; the game falls back to system fonts.

## Tests

With Node.js installed:

```sh
npm test
```

The tests cover binary scoring, deterministic generation, shortest solutions, operation inverses, mode-specific rules, saved progress, and daily rollover.

## GitHub Pages

Pages serves the root of the `main` branch. `.nojekyll` enables direct static-file publishing. Pushing updates to `main` triggers publication.

Daily puzzles are generated in the browser using the UTC date as a seed; no server, scheduled job, API key, or daily deployment is needed. File paths are relative, so the game works under a repository URL such as `/1023dle/`.

## Source

- `index.html`: interface and instructions
- `style.css`: responsive styles
- `game.js`: modes, controls, rendering, local saves, and sharing
- `puzzle.js`: deterministic generator and exact reverse breadth-first solver
- `leaderboard.js`: public standings, player setup and score syncing
- `server/worker.mjs`: score API and replay validation
- `db/` and `drizzle/`: database schema and migrations
- `tests/`: game, API and saved-state checks

When changing the generator or move rules, version the puzzle seed and saved-state keys together so old move histories are not replayed against incompatible puzzles. Cosmetic edits do not require new save keys.

## Shared leaderboards

The **Leaderboards** button opens today's Daily standings and the lifetime Endless board.

- **Daily:** fewest moves wins. Solve the puzzle and choose **Submit to Daily board**. The server checks the move sequence and keeps the first submitted score for that player and UTC date. Equal move counts share a rank.
- **Lifetime Endless:** the total number of circuits cleared across **all ranked runs**. Choose **Start ranked run** in Endless. Every verified clear adds one point immediately, even if the run later fails. Old local runs are not imported.
- Pick a public nickname once. A random player credential is stored in this browser; only its hash is kept on the server. Names are unique ignoring case. There is no password or cross-device recovery; clearing browser data loses access to that identity.
- Ranked rounds are issued by the server and checked against the exact solver's minimum + 2 budget. Requests can be retried without duplicate points. A connection is needed to sync a finished round and get the next one. Daily, Practice and unranked Endless remain playable without the service.
- These checks reject invented totals and invalid solutions, but cannot prevent someone from using a solver or making multiple browser identities.

### Hosting

The game stays on GitHub Pages. Shared scores live in a Cloudflare D1 database behind the existing Sites service at `https://play-1023.pr141.chatgpt.site/api`. The old game's pages are preserved there. No private service credentials belong in the public repository.

The backend source is `server/worker.mjs`, using the **same `puzzle.js`** as the browser. `db/schema.ts` and the committed `drizzle/` migrations define the database. The deployed Worker requires the D1 binding `DB`; migrations must be applied by the hosting platform before it serves requests. `npm run build` produces `dist/server/index.js`, including frontend assets for standalone hosting. GitHub Pages itself needs no build.

When deploying the API elsewhere, update the base URL in `leaderboard.js` and the allowed frontend origins in `server/worker.mjs`. Deploy the API and its database migrations separately from the Pages frontend. Keep both puzzle engines and `colour-v2` rules identifiers in sync.

### Full local development

With Node.js 24+:

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:4173`. The development server provides the game and a temporary, in-memory SQLite leaderboard. Restarting it clears test scores. `npm test` includes API tests against real SQLite, replay validation, ties, duplicate requests, cumulative totals, offline retry and saved ranked progress. `npm run db:generate` generates new migrations after intentional schema changes; do not edit an applied migration.

## Themes

Choose Forest (the original), Midnight, Paper, Ember or Arcade from the header’s Theme selector. The palette is saved in this browser and applies to the game, results and leaderboards. Lamp colours and symbols keep the same meanings.
