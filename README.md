# Woodpecker Chess Creator

A web app for building chess puzzle sets and solving them in repeated cycles, following The Woodpecker Method.

Everything is stored in your browser (IndexedDB), so there is no server or sign-in.

## Development

```sh
npm install
npm run dev     # start the app at http://localhost:5173
npm test        # run the tests
npm run build   # type-check and build for production
```

## Code layout

- `src/model/` – data types (sets, puzzles, cycles), cycle and session summaries, and the book's points (`points.ts`)
- `src/chess/` – puzzle parsing (FEN/PGN) and move checking, built on chess.js
- `src/storage/` – browser database (Dexie) and the repository the UI uses
- `src/pages/`, `src/components/` – screens (sets, set detail, puzzle editor) and the board components
- `src/router.ts` – hash-based routes, so links and refreshes work on any static host

## Points and reports

Scoring follows the book: 1 point for the first move, plus 1 for each move marked with a ✓.
A puzzle's ticked moves are stored as labels like `40.Kxb5` (in .md files, a `**Ticks:** 40.Kxb5, 41.Kb5`
line); with none, the last move of the line counts. After each puzzle the app suggests the points from the
moves played and the solver can correct them. Reports show time, points and days per session and per cycle.
The Woodpecker is complete once a cycle is solved within one day, or after 7 cycles.

## Deployment

The app is hosted on Vercel, linked to this repository. Every push to `main` deploys to production,
and every pull request gets its own preview URL. Vercel detects the Vite setup automatically
(build command `npm run build`, output folder `dist`).
