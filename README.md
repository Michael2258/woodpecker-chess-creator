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

- `src/model/` – data types (sets, puzzles, cycles) and cycle summaries
- `src/chess/` – puzzle parsing (FEN/PGN) and move checking, built on chess.js
- `src/storage/` – browser database (Dexie) and the repository the UI uses
