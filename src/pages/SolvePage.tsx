import { Chess } from 'chess.js'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { CycleHistory } from '../components/CycleHistory'
import { PlayBoard, type BoardMove } from '../components/PlayBoard'
import { checkSolverMove, formatLine, solverColor } from '../chess/puzzle'
import { formatDuration, nextPuzzleInCycle, summarizeCycle } from '../model/cycles'
import { displayTitle } from '../model/display'
import type { Cycle, Puzzle, PuzzleSet } from '../model/types'
import { repo } from '../repo'
import { paths } from '../router'

export function SolvePage({ setId }: { setId: string }) {
  const data = useLiveQuery(
    async () => ({
      set: await repo.getSet(setId),
      puzzles: await repo.listPuzzles(setId),
      cycles: await repo.listCycles(setId),
    }),
    [setId],
  )
  // After the last puzzle, keep showing that cycle's summary.
  const [summaryFor, setSummaryFor] = useState<string | null>(null)
  // The cycle being solved stays on screen even once its last result is saved,
  // so the final puzzle's result is shown before the summary.
  const [pinned, setPinned] = useState<string | null>(null)

  if (data === undefined) return <p className="muted">Loading…</p>
  const { set, puzzles, cycles } = data
  if (!set) {
    return (
      <section className="card">
        <h2>Set not found</h2>
        <a href={paths.home()}>Back to your sets</a>
      </section>
    )
  }

  const summaryCycle = summaryFor ? cycles.find((c) => c.id === summaryFor) : undefined
  const current = cycles.find((c) => c.completedAt === null)
  const sessionCycle = summaryFor ? undefined : (cycles.find((c) => c.id === pinned) ?? current)
  if (sessionCycle && sessionCycle.id !== pinned) setPinned(sessionCycle.id)

  let body
  if (summaryCycle) {
    body = (
      <CycleSummary
        set={set}
        cycle={summaryCycle}
        cycles={cycles}
        puzzles={puzzles}
        onStartNext={async () => {
          await repo.startCycle(set.id)
          setSummaryFor(null)
        }}
      />
    )
  } else if (sessionCycle && puzzles.length > 0) {
    body = (
      <Session
        key={sessionCycle.id}
        cycle={sessionCycle}
        puzzles={puzzles}
        onFinished={(id) => {
          setSummaryFor(id)
          setPinned(null)
        }}
      />
    )
  } else {
    body = <StartView set={set} puzzles={puzzles} cycles={cycles} />
  }

  return (
    <>
      <nav className="crumbs">
        <a href={paths.set(set.id)}>← {set.name}</a>
      </nav>
      {body}
    </>
  )
}

function StartView({ set, puzzles, cycles }: { set: PuzzleSet; puzzles: Puzzle[]; cycles: Cycle[] }) {
  const next = Math.max(0, ...cycles.map((c) => c.number)) + 1
  if (puzzles.length === 0) {
    return (
      <section className="card empty">
        <p>Add some puzzles to this set before you start solving.</p>
        <a className="button" href={paths.newPuzzle(set.id)}>
          Add a puzzle
        </a>
      </section>
    )
  }
  return (
    <>
      <section className="card stack start-card">
        <h2>{set.name}</h2>
        <p className="muted">
          {next === 1
            ? `Solve all ${puzzles.length} puzzles in order. Then repeat the set in new cycles, aiming to go faster each time while staying accurate.`
            : `Cycle ${next} of ${puzzles.length} puzzles. Try to beat your last time.`}
        </p>
        <p className="muted small">
          Your progress is saved after every puzzle, so you can stop and come back to a cycle later.
        </p>
        <div>
          <button onClick={() => repo.startCycle(set.id)}>Start cycle {next}</button>
        </div>
      </section>
      <CycleHistory cycles={cycles} />
    </>
  )
}

function Session({
  cycle,
  puzzles,
  onFinished,
}: {
  cycle: Cycle
  puzzles: Puzzle[]
  onFinished: (cycleId: string) => void
}) {
  // Stay on the current puzzle after its result is saved, until "Next" is pressed.
  const [puzzleId, setPuzzleId] = useState<string | null>(() => nextPuzzleInCycle(cycle, puzzles)?.id ?? null)
  const puzzle = puzzles.find((p) => p.id === puzzleId) ?? nextPuzzleInCycle(cycle, puzzles)
  const index = puzzle ? puzzles.findIndex((p) => p.id === puzzle.id) : -1
  const doneCount = cycle.attempts.length
  const elapsed = summarizeCycle(cycle).totalTimeMs

  function goNext() {
    const next = nextPuzzleInCycle(cycle, puzzles)
    if (next) setPuzzleId(next.id)
    else onFinished(cycle.id)
  }

  async function abandon() {
    if (!confirm(`Abandon cycle ${cycle.number}? Its results so far will be deleted.`)) return
    await repo.deleteCycle(cycle.id)
  }

  if (!puzzle) {
    // Every puzzle was attempted (e.g. puzzles were deleted mid-cycle).
    return (
      <section className="card stack">
        <p>All puzzles in this cycle are done.</p>
        <div>
          <button onClick={() => onFinished(cycle.id)}>See results</button>
        </div>
      </section>
    )
  }

  return (
    <>
      <div className="session-bar">
        <span>
          <strong>Cycle {cycle.number}</strong> · Puzzle {index + 1} of {puzzles.length}
        </span>
        <span className="muted">
          {doneCount} done · {formatDuration(elapsed)} so far
        </span>
        <button className="ghost small" onClick={abandon}>
          Abandon cycle
        </button>
      </div>
      <div className="progress" aria-hidden="true">
        <div style={{ width: `${(doneCount / puzzles.length) * 100}%` }} />
      </div>
      <PuzzleRun key={puzzle.id} puzzle={puzzle} number={index + 1} cycleId={cycle.id} onNext={goNext} />
    </>
  )
}

type Status = 'solving' | 'solved' | 'missed'

function PuzzleRun({
  puzzle,
  number,
  cycleId,
  onNext,
}: {
  puzzle: Puzzle
  number: number
  cycleId: string
  onNext: () => void
}) {
  const [fen, setFen] = useState(puzzle.fen)
  const [ply, setPly] = useState(0)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [status, setStatus] = useState<Status>('solving')
  const [busy, setBusy] = useState(false)
  const [wrong, setWrong] = useState<{ played: string; expected: string } | null>(null)
  const [timeMs, setTimeMs] = useState(0)
  const [showingSolution, setShowingSolution] = useState(false)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(startedAt)
  const timers = useRef<number[]>([])
  const nextButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (status !== 'solving') return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [status])

  useEffect(() => {
    if (status !== 'solving') nextButton.current?.focus()
  }, [status])

  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const color = solverColor(puzzle.fen)

  async function finish(solved: boolean) {
    const spent = Date.now() - startedAt
    setTimeMs(spent)
    setStatus(solved ? 'solved' : 'missed')
    await repo.recordAttempt(cycleId, { puzzleId: puzzle.id, solved, timeMs: spent })
  }

  function onMove(move: BoardMove) {
    if (status !== 'solving' || busy) return
    const result = checkSolverMove(fen, puzzle.solution, ply, move)
    if (result.result === 'illegal') return

    const chess = new Chess(fen)
    const played = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' })
    setFen(chess.fen())
    setLastMove({ from: played.from, to: played.to })

    if (result.result === 'wrong') {
      setWrong({ played: played.san, expected: result.expected })
      void finish(false)
      return
    }
    if (result.solved) {
      void finish(true)
      return
    }
    // Show the solver's move, then the opponent's reply.
    setBusy(true)
    later(() => {
      const reply = new Chess(chess.fen()).move(result.reply!)
      setFen(result.fen)
      setLastMove({ from: reply.from, to: reply.to })
      setPly(result.nextPly)
      setBusy(false)
    }, 400)
  }

  function showSolution() {
    setShowingSolution(true)
    const chess = new Chess(puzzle.fen)
    setFen(puzzle.fen)
    setLastMove(null)
    puzzle.solution.forEach((san, i) => {
      later(() => {
        const m = chess.move(san)
        setFen(chess.fen())
        setLastMove({ from: m.from, to: m.to })
      }, 600 * (i + 1))
    })
  }

  const shownTime = status === 'solving' ? now - startedAt : timeMs

  return (
    <div className="editor-layout">
      <div className="editor-board">
        <PlayBoard
          id="solve"
          fen={fen}
          orientation={color}
          onMove={onMove}
          movable={status === 'solving' && !busy ? color : 'none'}
          lastMove={lastMove}
        />
      </div>

      <div className="editor-side">
        <section className="card stack">
          <div className="row spread">
            <h3>{displayTitle(puzzle.title, number)}</h3>
            <span className={`timer ${status}`}>{formatDuration(shownTime)}</span>
          </div>

          {status === 'solving' && (
            <p className={`to-move ${color}`}>
              <span className="dot" /> {color === 'white' ? 'White' : 'Black'} to move. Find the best move.
            </p>
          )}

          {status === 'solved' && <p className="result good">✓ Solved in {formatDuration(timeMs)}</p>}

          {status === 'missed' && (
            <div className="stack">
              <p className="result bad">
                ✗ {wrong ? `${wrong.played} isn't it. The move was ${wrong.expected}.` : 'Missed.'}
              </p>
              {showingSolution ? (
                <p className="line">{formatLine(puzzle.fen, puzzle.solution)}</p>
              ) : (
                <div>
                  <button className="secondary" onClick={showSolution}>
                    Show the solution
                  </button>
                </div>
              )}
            </div>
          )}

          {status === 'solving' && (
            <div>
              <button
                className="ghost small"
                onClick={() => {
                  setWrong(null)
                  void finish(false)
                  showSolution()
                }}
              >
                Give up and show the solution
              </button>
            </div>
          )}

          {status !== 'solving' && (
            <div>
              <button ref={nextButton} onClick={onNext}>
                Next puzzle →
              </button>
            </div>
          )}
        </section>

        {status !== 'solving' && <NoteEditor puzzle={puzzle} />}
      </div>
    </div>
  )
}

function NoteEditor({ puzzle }: { puzzle: Puzzle }) {
  const [note, setNote] = useState(puzzle.note)
  const [saved, setSaved] = useState(false)
  return (
    <section className="card stack">
      <label>
        Note
        <textarea
          rows={3}
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setSaved(false)
          }}
          placeholder="Themes, what you missed, anything to remember next cycle"
        />
      </label>
      <div className="row">
        <button
          className="secondary"
          disabled={note === puzzle.note && !saved}
          onClick={async () => {
            await repo.updatePuzzle(puzzle.id, { note })
            setSaved(true)
          }}
        >
          Save note
        </button>
        {saved && <span className="muted small">Saved</span>}
      </div>
    </section>
  )
}

function CycleSummary({
  set,
  cycle,
  cycles,
  puzzles,
  onStartNext,
}: {
  set: PuzzleSet
  cycle: Cycle
  cycles: Cycle[]
  puzzles: Puzzle[]
  onStartNext: () => void
}) {
  const s = summarizeCycle(cycle)
  const previous = cycles.filter((c) => c.completedAt !== null && c.number < cycle.number).at(-1)
  const p = previous ? summarizeCycle(previous) : null
  const missed = cycle.attempts
    .filter((a) => !a.solved)
    .map((a) => puzzles.find((pz) => pz.id === a.puzzleId))
    .filter((pz): pz is Puzzle => !!pz)

  const timeDiff = p ? s.totalTimeMs - p.totalTimeMs : 0
  const accDiff = p ? Math.round((s.accuracy - p.accuracy) * 100) : 0

  return (
    <>
      <section className="card stack">
        <h2>Cycle {cycle.number} complete</h2>
        <div className="stats">
          <div>
            <span className="stat">{formatDuration(s.totalTimeMs)}</span>
            <span className="muted small">
              total time
              {p && ` · ${timeDiff <= 0 ? `${formatDuration(-timeDiff)} faster` : `${formatDuration(timeDiff)} slower`}`}
            </span>
          </div>
          <div>
            <span className="stat">{Math.round(s.accuracy * 100)}%</span>
            <span className="muted small">
              {s.solved} of {s.attempted} solved
              {p && ` · ${accDiff >= 0 ? '+' : ''}${accDiff} pts`}
            </span>
          </div>
          <div>
            <span className="stat">{formatDuration(s.attempted ? s.totalTimeMs / s.attempted : 0)}</span>
            <span className="muted small">per puzzle</span>
          </div>
        </div>
        <div className="row wrap">
          <button onClick={onStartNext}>Start cycle {cycle.number + 1}</button>
          <a className="button secondary-link" href={paths.set(set.id)}>
            Back to set
          </a>
        </div>
      </section>

      {missed.length > 0 && (
        <section className="card">
          <h3>Missed this cycle</h3>
          <ul className="missed">
            {missed.map((pz) => {
              const n = puzzles.indexOf(pz) + 1
              return (
                <li key={pz.id}>
                  <a href={paths.editPuzzle(set.id, pz.id)}>{displayTitle(pz.title, n)}</a>
                  <span className="muted small"> {formatLine(pz.fen, pz.solution)}</span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <CycleHistory cycles={cycles} />
    </>
  )
}
