import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type FormEvent } from 'react'
import { formatLine, solverColor } from '../chess/puzzle'
import { displayTitle } from '../model/display'
import type { Cycle, Puzzle, PuzzleSet } from '../model/types'
import { CycleHistory } from '../components/CycleHistory'
import { MarkdownImport } from '../components/MarkdownImport'
import { repo } from '../repo'
import { navigate, paths } from '../router'

export function SetPage({ setId }: { setId: string }) {
  const data = useLiveQuery(
    async () => ({
      set: await repo.getSet(setId),
      puzzles: await repo.listPuzzles(setId),
      cycles: await repo.listCycles(setId),
    }),
    [setId],
  )

  if (data === undefined) return <p className="muted">Loading…</p>
  if (!data.set) {
    return (
      <section className="card">
        <h2>Set not found</h2>
        <p>
          It may have been deleted. <a href={paths.home()}>Back to your sets</a>
        </p>
      </section>
    )
  }
  return <SetView set={data.set} puzzles={data.puzzles} cycles={data.cycles} />
}

function SetView({ set, puzzles, cycles }: { set: PuzzleSet; puzzles: Puzzle[]; cycles: Cycle[] }) {
  const [editing, setEditing] = useState(false)

  async function move(index: number, delta: number) {
    const ids = puzzles.map((p) => p.id)
    const j = index + delta
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    await repo.reorderPuzzles(set.id, ids)
  }

  async function remove(p: Puzzle, n: number) {
    if (!confirm(`Delete ${displayTitle(p.title, n)}? This can't be undone.`)) return
    await repo.deletePuzzle(p.id)
  }

  async function deleteSet() {
    if (!confirm(`Delete "${set.name}" with its ${puzzles.length} puzzles and training history? This can't be undone.`)) return
    await repo.deleteSet(set.id)
    navigate(paths.home())
  }

  return (
    <>
      <nav className="crumbs">
        <a href={paths.home()}>← Your sets</a>
      </nav>

      <section className="card">
        {editing ? (
          <SetDetailsForm set={set} onDone={() => setEditing(false)} />
        ) : (
          <div className="set-head">
            <div>
              <h2 className="set-title">{set.name}</h2>
              {set.description && <p className="set-desc">{set.description}</p>}
              <p className="muted small">
                {puzzles.length} {puzzles.length === 1 ? 'puzzle' : 'puzzles'}
              </p>
            </div>
            <div className="row wrap">
              <button className="secondary" onClick={() => setEditing(true)}>
                Rename
              </button>
              <a className="button secondary-link" href={paths.newPuzzle(set.id)}>
                Add puzzle
              </a>
              {puzzles.length > 0 && (
                <a className="button" href={paths.solve(set.id)}>
                  {solveLabel(cycles, puzzles.length)}
                </a>
              )}
            </div>
          </div>
        )}
        {!editing && (
          <div className="import-block">
            <MarkdownImport target={{ kind: 'set', setId: set.id }} label="Import puzzles from a .md file" />
          </div>
        )}
      </section>

      {puzzles.length === 0 ? (
        <section className="card empty">
          <p>This set has no puzzles yet.</p>
          <a className="button" href={paths.newPuzzle(set.id)}>
            Add the first puzzle
          </a>
        </section>
      ) : (
        <ol className="puzzle-list">
          {puzzles.map((p, i) => (
            <li key={p.id} className="puzzle-row">
              <span className="num">{i + 1}</span>
              <a className="puzzle-main" href={paths.editPuzzle(set.id, p.id)}>
                <span className="puzzle-title">{displayTitle(p.title, i + 1)}</span>
                <span className="muted small">
                  {solverColor(p.fen) === 'white' ? 'White' : 'Black'} to move · {formatLine(p.fen, p.solution)}
                </span>
                {p.note && <span className="note small">{p.note}</span>}
              </a>
              <span className="row actions">
                <button className="icon" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                  ↑
                </button>
                <button
                  className="icon"
                  onClick={() => move(i, 1)}
                  disabled={i === puzzles.length - 1}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button className="icon danger" onClick={() => remove(p, i + 1)} aria-label="Delete puzzle">
                  ✕
                </button>
              </span>
            </li>
          ))}
        </ol>
      )}

      <CycleHistory cycles={cycles} />

      <section className="danger-zone">
        <button className="ghost danger" onClick={deleteSet}>
          Delete this set
        </button>
      </section>
    </>
  )
}

function SetDetailsForm({ set, onDone }: { set: PuzzleSet; onDone: () => void }) {
  const [name, setName] = useState(set.name)
  const [description, setDescription] = useState(set.description)
  const [error, setError] = useState<string | null>(null)

  async function save(e: FormEvent) {
    e.preventDefault()
    try {
      await repo.updateSet(set.id, { name: name.trim(), description: description.trim() })
      onDone()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <label>
        Name
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>
      <label>
        Description
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="row">
        <button type="submit">Save</button>
        <button type="button" className="secondary" onClick={onDone}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function solveLabel(cycles: Cycle[], total: number): string {
  const open = cycles.find((c) => c.completedAt === null)
  if (open) return `Continue cycle ${open.number} (${open.attempts.length}/${total})`
  if (cycles.length === 0) return 'Start solving'
  return `Start cycle ${Math.max(...cycles.map((c) => c.number)) + 1}`
}
