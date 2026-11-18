import { useRef, useState, type FormEvent } from 'react'
import { parseMarkdownPuzzles, type MarkdownImport as Parsed } from '../chess/markdown'
import { formatLine, solverColor } from '../chess/puzzle'
import { repo } from '../repo'
import { navigate, paths } from '../router'

type Target = { kind: 'newSet' } | { kind: 'set'; setId: string }

/**
 * Lets the user pick a .md file of puzzles, previews what was found in it,
 * and adds the puzzles to an existing set or to a new one.
 */
export function MarkdownImport({ target, label }: { target: Target; label: string }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ fileName: string; parsed: Parsed } | null>(null)
  const [setName, setSetName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onPick(f: File | undefined) {
    if (input.current) input.current.value = ''
    if (!f) return
    setError(null)
    try {
      const parsed = parseMarkdownPuzzles(await f.text())
      setFile({ fileName: f.name, parsed })
      setSetName(parsed.name || f.name.replace(/\.(md|markdown|txt)$/i, ''))
    } catch (err) {
      setError(`Could not read ${f.name}: ${(err as Error).message}`)
    }
  }

  async function onImport(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      if (target.kind === 'newSet') {
        const set = await repo.createSet(setName)
        try {
          await repo.addPuzzles(set.id, file.parsed.puzzles)
        } catch (err) {
          await repo.deleteSet(set.id)
          throw err
        }
        navigate(paths.set(set.id))
      } else {
        await repo.addPuzzles(target.setId, file.parsed.puzzles)
      }
      setFile(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept=".md,.markdown,.txt,text/markdown,text/plain"
      className="sr"
      tabIndex={-1}
      onChange={(e) => onPick(e.target.files?.[0])}
    />
  )

  if (!file) {
    return (
      <>
        {picker}
        <button type="button" className="secondary" onClick={() => input.current?.click()}>
          {label}
        </button>
        {error && <p className="error">{error}</p>}
      </>
    )
  }

  const { puzzles, skipped } = file.parsed
  return (
    <form className="card stack import-preview" onSubmit={onImport}>
      {picker}
      <div>
        <h3>Import from {file.fileName}</h3>
        <p className="muted small">
          {puzzles.length === 0
            ? 'No puzzles with a solution were found in this file.'
            : `Found ${puzzles.length} ${puzzles.length === 1 ? 'puzzle' : 'puzzles'}${
                target.kind === 'set' ? ', to be added at the end of this set' : ''
              }.`}
        </p>
      </div>

      {target.kind === 'newSet' && puzzles.length > 0 && (
        <label>
          Set name
          <input type="text" value={setName} onChange={(e) => setSetName(e.target.value)} />
        </label>
      )}

      {puzzles.length > 0 && (
        <ol className="import-list">
          {puzzles.map((p, i) => (
            <li key={i}>
              <span className="puzzle-title">{p.title || `Puzzle ${i + 1}`}</span>
              <span className="muted small">
                {solverColor(p.fen) === 'white' ? 'White' : 'Black'} to move · {formatLine(p.fen, p.solution)}
              </span>
              {p.note && <span className="note small">{p.note}</span>}
            </li>
          ))}
        </ol>
      )}

      {skipped.length > 0 && (
        <div className="skipped small">
          <p className="muted">
            Skipped {skipped.length} {skipped.length === 1 ? 'section' : 'sections'}:
          </p>
          <ul>
            {skipped.map((s, i) => (
              <li key={i}>
                <strong>{s.heading || 'Untitled'}</strong>: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="error">{error}</p>}
      <div className="row wrap">
        <button type="submit" disabled={busy || puzzles.length === 0}>
          {target.kind === 'newSet' ? 'Create set' : 'Add'} with {puzzles.length}{' '}
          {puzzles.length === 1 ? 'puzzle' : 'puzzles'}
        </button>
        <button type="button" className="secondary" onClick={() => input.current?.click()} disabled={busy}>
          Choose another file
        </button>
        <button type="button" className="ghost" onClick={() => setFile(null)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  )
}
