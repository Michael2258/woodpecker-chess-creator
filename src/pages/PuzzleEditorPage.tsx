import { Chess } from 'chess.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { PlayBoard, type BoardMove } from '../components/PlayBoard'
import { CopyFenButton } from '../components/CopyFenButton'
import { PositionEditor } from '../components/PositionEditor'
import { fenAfter, formatLine, parsePuzzleInput, solverColor } from '../chess/puzzle'
import { fenFromSetup, placementFromFen, START_FEN, type Placement } from '../chess/setup'
import { formatTickList, parseTickList, resolveTicks } from '../model/points'
import type { Puzzle } from '../model/types'
import { repo } from '../repo'
import { navigate, paths } from '../router'

interface Props {
  setId: string
  puzzleId?: string
}

export function PuzzleEditorPage({ setId, puzzleId }: Props) {
  const data = useLiveQuery(
    async () => ({
      set: await repo.getSet(setId),
      puzzle: puzzleId ? await repo.listPuzzles(setId).then((ps) => ps.find((p) => p.id === puzzleId) ?? null) : null,
    }),
    [setId, puzzleId],
  )
  if (data === undefined) return <p className="muted">Loading…</p>
  if (!data.set || (puzzleId && !data.puzzle)) {
    return (
      <section className="card">
        <h2>Not found</h2>
        <p>
          This puzzle or set may have been deleted. <a href={paths.home()}>Back to your sets</a>
        </p>
      </section>
    )
  }
  // Keyed so that "Save and add another" starts from a clean editor.
  return <Editor key={puzzleId ?? 'new'} setId={setId} setName={data.set.name} puzzle={data.puzzle} />
}

type Mode = 'position' | 'solution'

function Editor({ setId, setName, puzzle }: { setId: string; setName: string; puzzle: Puzzle | null }) {
  const [mode, setMode] = useState<Mode>(puzzle ? 'solution' : 'position')
  const [placement, setPlacementRaw] = useState<Placement>(() => placementFromFen(puzzle?.fen ?? START_FEN))
  const [history, setHistory] = useState<Placement[]>([])
  function setPlacement(next: Placement) {
    setHistory((h) => [...h.slice(-99), placement])
    setPlacementRaw(next)
  }
  function undoPlacement() {
    if (!history.length) return
    setPlacementRaw(history[history.length - 1])
    setHistory(history.slice(0, -1))
  }
  const [turn, setTurn] = useState<'w' | 'b'>(() => ((puzzle?.fen ?? START_FEN).split(' ')[1] as 'w' | 'b'))
  const [startFen, setStartFen] = useState<string | null>(puzzle?.fen ?? null)
  const [solution, setSolution] = useState<string[]>(puzzle?.solution ?? [])
  const [title, setTitle] = useState(puzzle?.title ?? '')
  const [note, setNote] = useState(puzzle?.note ?? '')
  const [ticksText, setTicksText] = useState(formatTickList(puzzle?.ticks ?? []))
  const [paste, setPaste] = useState('')
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  function loadPaste() {
    const r = parsePuzzleInput(paste)
    if (!r.ok) {
      setMessage({ kind: 'error', text: r.error })
      return
    }
    setPlacement(placementFromFen(r.puzzle.fen))
    setTurn(r.puzzle.fen.split(' ')[1] as 'w' | 'b')
    setPaste('')
    if (r.puzzle.solution.length > 0) {
      setStartFen(r.puzzle.fen)
      setSolution(r.puzzle.solution)
      setMode('solution')
      setMessage({ kind: 'info', text: `Loaded the position and ${r.puzzle.solution.length} solution moves.` })
    } else {
      setStartFen(null)
      setSolution([])
      setMessage({ kind: 'info', text: 'Loaded the position. Check it, then record the solution.' })
    }
  }

  function goToSolution() {
    // Keep the original FEN (with its move number) if the board wasn't touched.
    const unchanged =
      startFen &&
      startFen.split(' ')[1] === turn &&
      JSON.stringify(sorted(placementFromFen(startFen))) === JSON.stringify(sorted(placement))
    if (unchanged) {
      setMode('solution')
      setMessage(null)
      return
    }
    const r = fenFromSetup(placement, turn)
    if (!r.ok) {
      setMessage({ kind: 'error', text: r.error })
      return
    }
    if (solution.length > 0 && !confirm('The position changed, so the recorded solution will be cleared. Continue?')) return
    setStartFen(r.fen)
    setSolution([])
    setMode('solution')
    setMessage(null)
  }

  function onMove(move: BoardMove) {
    if (!startFen) return
    const chess = new Chess(fenAfter(startFen, solution))
    const played = chess.move(move)
    setSolution([...solution, played.san])
  }

  async function save(addAnother: boolean) {
    if (!startFen) return
    setSaving(true)
    try {
      const fields = { fen: startFen, solution, title: title.trim(), note, ticks: parseTickList(ticksText) }
      if (puzzle) await repo.updatePuzzle(puzzle.id, fields)
      else await repo.addPuzzle(setId, fields)
      if (addAnother) {
        setResetKey((k) => k + 1)
        setMode('position')
        setStartFen(null)
        setSolution([])
        setTitle(nextTitle(title))
        setNote('')
        setTicksText('')
        setMessage({ kind: 'info', text: 'Saved. Set up the next puzzle.' })
        window.scrollTo({ top: 0 })
      } else {
        navigate(paths.set(setId))
      }
    } catch (err) {
      setMessage({ kind: 'error', text: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const currentFen = startFen ? fenAfter(startFen, solution) : null
  const defaultTick = startFen && solution.length ? resolveTicks(startFen, solution, undefined)[0]?.label : null
  const lastMove = startFen && solution.length ? lastMoveSquares(startFen, solution) : null

  return (
    <>
      <nav className="crumbs">
        <a href={paths.set(setId)}>← {setName}</a>
      </nav>
      <h2 className="page-title">{puzzle ? 'Edit puzzle' : 'Add a puzzle'}</h2>

      <div className="steps" role="tablist">
        <button role="tab" aria-selected={mode === 'position'} className={mode === 'position' ? 'active' : ''} onClick={() => setMode('position')}>
          1. Position
        </button>
        <button role="tab" aria-selected={mode === 'solution'} className={mode === 'solution' ? 'active' : ''} onClick={goToSolution}>
          2. Solution
        </button>
      </div>

      {message && <p className={message.kind === 'error' ? 'error' : 'info'}>{message.text}</p>}

      <div className="editor-layout">
        <div className="editor-board">
          {mode === 'position' ? (
            <PositionEditor
              key={resetKey}
              placement={placement}
              onChange={setPlacement}
              turn={turn}
              onTurnChange={setTurn}
              onUndo={undoPlacement}
              canUndo={history.length > 0}
            />
          ) : (
            currentFen && (
              <PlayBoard
                id="record"
                fen={currentFen}
                orientation={solverColor(startFen!)}
                onMove={onMove}
                lastMove={lastMove}
              />
            )
          )}
          {mode === 'solution' && (
            <div className="row wrap board-actions">
              <button className="secondary" onClick={() => setSolution(solution.slice(0, -1))} disabled={!solution.length}>
                ↶ Undo move
              </button>
              <button className="secondary" onClick={() => setSolution([])} disabled={!solution.length}>
                Clear moves
              </button>
              {currentFen && <CopyFenButton fen={currentFen} className="secondary" />}
            </div>
          )}
        </div>

        <div className="editor-side">
          {mode === 'position' ? (
            <section className="card stack">
              <h3>Paste a FEN or PGN</h3>
              <textarea
                rows={4}
                value={paste}
                onChange={(e) => setPaste(e.target.value)}
                placeholder={'e.g. 6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1\nor a PGN with a [FEN "..."] header and the solution moves'}
                aria-label="FEN or PGN"
              />
              <button className="secondary" onClick={loadPaste} disabled={!paste.trim()}>
                Load
              </button>
              <p className="muted small">
                Or set it up on the board: pick a piece and tap squares to place it, or use ✥ to drag pieces around.
                Drag a piece off the board to remove it.
              </p>
              <button onClick={goToSolution}>Next: record the solution →</button>
            </section>
          ) : (
            <>
              <section className="card stack">
                <h3>Solution</h3>
                <p className="muted small">
                  Play the moves for both sides, starting with {startFen && solverColor(startFen) === 'white' ? 'White' : 'Black'}.
                  Drag pieces, or tap a piece and then a square.
                </p>
                <p className="line" aria-live="polite">
                  {solution.length ? formatLine(startFen!, solution) : <span className="muted">No moves yet.</span>}
                </p>
              </section>

              <section className="card stack">
                <label>
                  Title <span className="muted small">(optional, e.g. the book's puzzle number)</span>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
                </label>
                <label>
                  Ticked moves <span className="muted small">(✓ in the book, 1 point each besides the first move)</span>
                  <input
                    type="text"
                    value={ticksText}
                    onChange={(e) => setTicksText(e.target.value)}
                    placeholder={defaultTick ? `${defaultTick} (the last move, if left empty)` : 'e.g. 20.Bxe6#, 19...Kf8'}
                  />
                </label>
                <label>
                  Note
                  <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Themes, what you missed, anything to remember" />
                </label>
                <div className="row wrap">
                  <button onClick={() => save(false)} disabled={saving || solution.length === 0}>
                    Save puzzle
                  </button>
                  {!puzzle && (
                    <button className="secondary" onClick={() => save(true)} disabled={saving || solution.length === 0}>
                      Save and add another
                    </button>
                  )}
                </div>
                {solution.length === 0 && <p className="muted small">Play at least one move to save.</p>}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  )
}

function sorted(p: Placement): Placement {
  return Object.fromEntries(Object.entries(p).sort(([a], [b]) => (a < b ? -1 : 1)))
}

function lastMoveSquares(fen: string, moves: string[]) {
  const chess = new Chess(fen)
  let last = null
  for (const m of moves) last = chess.move(m)
  return last ? { from: last.from, to: last.to } : null
}

/** "12" → "13", "Puzzle 7" → "Puzzle 8"; anything else is left empty. */
function nextTitle(title: string): string {
  const m = title.trim().match(/^(.*?)(\d+)$/)
  return m ? `${m[1]}${Number(m[2]) + 1}` : ''
}
