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

Open http://localhost:8000. No installation or build step is required. Google Fonts are optional; the game falls back to system fonts.

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
- `tests/`: dependency-free checks

When changing the generator or move rules, version the puzzle seed and saved-state keys together so old move histories are not replayed against incompatible puzzles. Cosmetic edits do not require new save keys.
