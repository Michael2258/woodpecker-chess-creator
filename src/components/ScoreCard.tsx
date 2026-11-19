import type { LinePly } from '../chess/puzzle'
import { maxPoints, scorePoints, type Score, type Tick } from '../model/points'

/**
 * The book's points for one puzzle: one for the first move and one for each
 * ticked (✓) move. Filled in from the moves played; the solver can correct it.
 */
export function ScoreCard({
  firstMove,
  ticks,
  score,
  onChange,
}: {
  firstMove: LinePly | undefined
  ticks: Tick[]
  score: Score
  onChange: (score: Score) => void
}) {
  return (
    <fieldset className="score-card">
      <legend>
        <span className="score-points">
          {scorePoints(score)}/{maxPoints(ticks.length)}
        </span>{' '}
        points
      </legend>
      <label className="check">
        <input
          type="checkbox"
          checked={score.firstMove}
          onChange={(e) => onChange({ ...score, firstMove: e.target.checked })}
        />
        <span>
          First move{firstMove && <span className="mono"> {firstMove.label}{firstMove.san}</span>}
        </span>
      </label>
      {ticks.map((t, i) => (
        <label className="check" key={i}>
          <input
            type="checkbox"
            checked={score.ticks[i] ?? false}
            onChange={(e) => onChange({ ...score, ticks: score.ticks.map((v, j) => (j === i ? e.target.checked : v)) })}
          />
          <span>
            Saw <span className="mono">✓ {t.label}</span>
            {t.ply === null && <span className="muted small"> (side line)</span>}
          </span>
        </label>
      ))}
      <p className="muted small">Untick anything you didn't really see, or tick what you saw but didn't get to play.</p>
    </fieldset>
  )
}
