import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { Chessboard } from 'react-chessboard'
import type { PuzzleSet } from './model/types'
import { db } from './storage/db'
import { createRepository } from './storage/repository'

const repo = createRepository(db)

interface SetRow extends PuzzleSet {
  puzzleCount: number
}

async function loadSets(): Promise<SetRow[]> {
  const list = await repo.listSets()
  return Promise.all(
    list.map(async (s) => ({ ...s, puzzleCount: (await repo.listPuzzles(s.id)).length })),
  )
}

export default function App() {
  const sets = useLiveQuery(loadSets) ?? null
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      await repo.createSet(name)
      setName('')
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function onDelete(set: SetRow) {
    if (!confirm(`Delete "${set.name}" with its ${set.puzzleCount} puzzles and training history?`)) return
    await repo.deleteSet(set.id)
  }

  return (
    <div className="app">
      <header>
        <h1>Woodpecker Chess Creator</h1>
        <p>Build puzzle sets and solve them in cycles.</p>
      </header>

      <div className="layout">
        <section className="card">
          <h2>Your sets</h2>
          <form className="inline" onSubmit={onCreate}>
            <input
              type="text"
              placeholder="New set name, e.g. Simple exercises 1–50"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-label="New set name"
            />
            <button type="submit">Create set</button>
          </form>
          {error && <p className="error">{error}</p>}
          {sets === null ? (
            <p className="muted">Loading…</p>
          ) : sets.length === 0 ? (
            <p className="muted">No sets yet. Create one to get started.</p>
          ) : (
            <ul className="sets">
              {sets.map((s) => (
                <li key={s.id}>
                  <span className="name">{s.name}</span>
                  <span className="muted">
                    {s.puzzleCount} {s.puzzleCount === 1 ? 'puzzle' : 'puzzles'}
                  </span>
                  <button className="ghost" onClick={() => onDelete(s)} aria-label={`Delete ${s.name}`}>
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="card">
          <h2>Board</h2>
          <Chessboard options={{ id: 'preview', allowDragging: false }} />
          <p className="muted">Adding puzzles and solve mode come in the next steps.</p>
        </aside>
      </div>
    </div>
  )
}
