import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { BackupCard } from '../components/BackupCard'
import { MarkdownImport } from '../components/MarkdownImport'
import { repo } from '../repo'
import { navigate, paths } from '../router'

async function loadSets() {
  const list = await repo.listSets()
  return Promise.all(list.map(async (s) => ({ ...s, puzzleCount: (await repo.listPuzzles(s.id)).length })))
}

export function HomePage() {
  const sets = useLiveQuery(loadSets)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    try {
      const set = await repo.createSet(name)
      setName('')
      setError(null)
      navigate(paths.set(set.id))
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <>
      <section className="card">
        <h2>Create a set</h2>
        <form className="inline" onSubmit={onCreate}>
          <input
            type="text"
            placeholder="Set name, e.g. Simple exercises 1–50"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="New set name"
          />
          <button type="submit">Create set</button>
        </form>
        {error && <p className="error">{error}</p>}
        <div className="import-block">
          <MarkdownImport target={{ kind: 'newSet' }} label="Or import a set from a .md file" />
        </div>
      </section>

      <h2 className="section-title">Your sets</h2>
      {sets === undefined ? (
        <p className="muted">Loading…</p>
      ) : sets.length === 0 ? (
        <p className="muted">No sets yet. Create one above to get started.</p>
      ) : (
        <ul className="set-grid">
          {sets.map((s) => (
            <li key={s.id}>
              <a className="set-card" href={paths.set(s.id)}>
                <span className="set-name">{s.name}</span>
                {s.description && <span className="set-desc">{s.description}</span>}
                <span className="muted small">
                  {s.puzzleCount} {s.puzzleCount === 1 ? 'puzzle' : 'puzzles'}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}

      <BackupCard />
    </>
  )
}
