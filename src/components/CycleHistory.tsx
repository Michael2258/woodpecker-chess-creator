import {
  formatDuration,
  formatPercent,
  GOAL_CYCLES,
  summarizeCycle,
  woodpeckerMessage,
  woodpeckerStatus,
} from '../model/cycles'
import type { Cycle, CycleSummary } from '../model/types'

/** Cycles side by side (table and charts), so progress across cycles is easy to compare. */
export function CycleHistory({ cycles }: { cycles: Cycle[] }) {
  const done = cycles.filter((c) => c.completedAt !== null).sort((a, b) => a.number - b.number)
  if (done.length === 0) return null
  const rows = done.map((c) => ({ cycle: c, s: summarizeCycle(c) }))
  const status = woodpeckerStatus(cycles)
  const message = woodpeckerMessage(status)
  const hasScore = rows.some((r) => r.s.score !== null)

  return (
    <section className="card stack">
      <h3>Your cycles</h3>
      {message ? (
        <p className="goal done">🎉 {message}</p>
      ) : (
        <p className="muted small">
          Goal: solve the whole set within one day, or finish {GOAL_CYCLES} cycles ({done.length} of {GOAL_CYCLES} done).
        </p>
      )}

      {rows.length > 1 && (
        <div className="charts">
          <BarChart
            title="Total time"
            rows={rows.map((r) => ({ n: r.s.cycleNumber, value: r.s.totalTimeMs, label: formatDuration(r.s.totalTimeMs) }))}
          />
          {hasScore ? (
            <BarChart
              title="Points score"
              max={1}
              rows={rows.map((r) => ({ n: r.s.cycleNumber, value: r.s.score ?? 0, label: formatPercent(r.s.score) }))}
            />
          ) : (
            <BarChart
              title="Solved"
              max={1}
              rows={rows.map((r) => ({ n: r.s.cycleNumber, value: r.s.accuracy, label: formatPercent(r.s.accuracy) }))}
            />
          )}
          <BarChart
            title="Days"
            rows={rows.map((r) => ({ n: r.s.cycleNumber, value: r.s.days, label: String(r.s.days) }))}
          />
        </div>
      )}

      <div className="table-scroll">
        <table className="cycles">
          <thead>
            <tr>
              <th>Cycle</th>
              <th>Dates</th>
              <th className="num-col">Days</th>
              <th className="num-col">Time</th>
              <th className="num-col">Solved</th>
              <th className="num-col">Points</th>
              <th className="num-col">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cycle: c, s }) => (
              <tr key={c.id}>
                <td>{c.number}</td>
                <td>{dateRange(c)}</td>
                <td className="num-col">{s.days}</td>
                <td className="num-col">{formatDuration(s.totalTimeMs)}</td>
                <td className="num-col">
                  {s.solved}/{s.attempted} ({formatPercent(s.accuracy)})
                </td>
                <td className="num-col">{pointsText(s)}</td>
                <td className="num-col">{formatPercent(s.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function pointsText(s: CycleSummary) {
  return s.score === null ? '–' : `${s.points}/${s.maxPoints}`
}

function dateRange(c: Cycle): string {
  const times = c.attempts.map((a) => a.attemptedAt)
  if (times.length === 0) return ''
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const a = fmt(Math.min(...times))
  const b = fmt(Math.max(...times))
  return a === b ? a : `${a} – ${b}`
}

/** A small single-series bar chart: one bar per cycle, value labels on top. */
function BarChart({
  title,
  rows,
  max,
}: {
  title: string
  rows: { n: number; value: number; label: string }[]
  max?: number
}) {
  const W = 300
  const H = 140
  const top = 18
  const bottom = 20
  const plotH = H - top - bottom
  const peak = max ?? Math.max(...rows.map((r) => r.value), 1)
  const slot = W / rows.length
  const barW = Math.min(36, slot - 6)
  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} per cycle`}>
        <line x1={0} x2={W} y1={top + plotH} y2={top + plotH} className="axis" />
        {rows.map((r, i) => {
          const h = Math.max(4, (r.value / peak) * plotH)
          const x = i * slot + (slot - barW) / 2
          const y = top + plotH - h
          return (
            <g key={r.n} className="bar">
              <title>{`Cycle ${r.n}: ${r.label}`}</title>
              <rect x={i * slot} y={0} width={slot} height={H} className="hit" />
              <path
                d={`M${x},${top + plotH} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + barW - 4} Q${x + barW},${y} ${x + barW},${y + 4} V${top + plotH} Z`}
              />
              <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="value">
                {r.label}
              </text>
              <text x={x + barW / 2} y={H - 5} textAnchor="middle" className="tick">
                {r.n}
              </text>
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
