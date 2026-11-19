import { useEffect } from 'react'
import type { LinePly } from '../chess/puzzle'

interface Props {
  plies: LinePly[]
  /** Number of moves played on the board: 0 is the start position. */
  ply: number
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
export function SolutionStepper({ plies, ply, onChange }: Props) {
  const last = plies.length

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || typingInField(e.target)) return
      const next = { ArrowLeft: ply - 1, ArrowRight: ply + 1, Home: 0, End: last }[e.key]
      if (next === undefined) return
      e.preventDefault()
      onChange(Math.max(0, Math.min(last, next)))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ply, last, onChange])

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
        <button className="icon" onClick={() => onChange(ply - 1)} disabled={ply === 0} aria-label="Previous move" title="Previous move (←)">
          {'\u25C0\uFE0E'}
        </button>
        <button className="icon" onClick={() => onChange(ply + 1)} disabled={ply === last} aria-label="Next move" title="Next move (→)">
          {'\u25B6\uFE0E'}
        </button>
        <button className="icon" onClick={() => onChange(last)} disabled={ply === last} aria-label="Jump to end" title="Jump to end (End)">
          {'\u23ED\uFE0E'}
        </button>
        <span className="muted small">
          {ply === 0 ? 'Start position' : `Move ${ply} of ${last}`}
        </span>
      </div>
      <p className="muted small hint">Use the ← and → keys to step through the moves.</p>
    </div>
  )
}
