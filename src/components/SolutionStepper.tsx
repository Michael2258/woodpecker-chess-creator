import { useEffect } from 'react'
import type { LinePly } from '../chess/puzzle'

interface Props {
  plies: LinePly[]
  /**
   * Number of solution moves played on the board: 0 is the start position.
   * Null while the board shows the solver's own move instead of the line.
   */
  ply: number | null
  /** With `ply` null, how many solution moves came before the solver's own move. */
  offLine?: number
  /** The solver's own move, shown in the status while `ply` is null. */
  ownMove?: string
  onChange: (ply: number) => void
}

function typingInField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

/**
 * Controls for stepping through a solution one move at a time: buttons,
 * the arrow keys (plus Home/End), and a clickable move list.
 */
export function SolutionStepper({ plies, ply, offLine = 0, ownMove, onChange }: Props) {
  const last = plies.length
  // Off the line, "previous" goes back to the position before the solver's
  // move and "next" shows the right move there.
  const prev = ply === null ? offLine : ply - 1
  const next = ply === null ? offLine + 1 : ply + 1

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || typingInField(e.target)) return
      const target = { ArrowLeft: prev, ArrowRight: next, Home: 0, End: last }[e.key]
      if (target === undefined) return
      e.preventDefault()
      onChange(Math.max(0, Math.min(last, target)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, last, onChange])

  return (
    <div className="stepper stack">
      <ol className="move-list" aria-label="Solution moves">
        {plies.map((p, i) => (
          <li key={i}>
            {p.label && <span className="move-no">{p.label}</span>}
            <button
              className={`move${ply === i + 1 ? ' current' : ''}`}
              aria-current={ply === i + 1 ? 'step' : undefined}
              onClick={() => onChange(i + 1)}
            >
              {p.san}
            </button>
          </li>
        ))}
      </ol>
      <div className="step-controls" role="group" aria-label="Step through the solution">
        <button className="icon" onClick={() => onChange(0)} disabled={ply === 0} aria-label="Back to start" title="Back to start (Home)">
          {'\u23EE\uFE0E'}
        </button>
        <button className="icon" onClick={() => onChange(Math.max(0, prev))} disabled={ply === 0} aria-label="Previous move" title="Previous move (←)">
          {'\u25C0\uFE0E'}
        </button>
        <button className="icon" onClick={() => onChange(Math.min(last, next))} disabled={ply === last} aria-label="Next move" title="Next move (→)">
          {'\u25B6\uFE0E'}
        </button>
        <button className="icon" onClick={() => onChange(last)} disabled={ply === last} aria-label="Jump to end" title="Jump to end (End)">
          {'\u23ED\uFE0E'}
        </button>
        <span className="muted small">
          {ply === null ? `Your move: ${ownMove ?? ''}` : ply === 0 ? 'Start position' : `Move ${ply} of ${last}`}
        </span>
      </div>
      <p className="muted small hint">Use the ← and → keys to step through the moves.</p>
    </div>
  )
}
