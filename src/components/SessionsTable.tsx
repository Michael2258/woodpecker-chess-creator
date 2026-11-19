import { formatDuration, formatPercent, summarizeSessions } from '../model/cycles'
import type { Cycle } from '../model/types'

/** One row per solving session in a cycle, like the book's record sheet. */
export function SessionsTable({ cycle }: { cycle: Cycle }) {
  const sessions = summarizeSessions(cycle)
  if (sessions.length === 0) return null
  return (
    <section className="card">
      <h3>Sessions in cycle {cycle.number}</h3>
      <div className="table-scroll">
        <table className="cycles">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th className="num-col">Time</th>
              <th className="num-col">Puzzles</th>
              <th className="num-col">Solved</th>
              <th className="num-col">Points</th>
              <th className="num-col">Score</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, i) => (
              <tr key={s.key}>
                <td>{i + 1}</td>
                <td>{new Date(s.startedAt).toLocaleDateString()}</td>
                <td className="num-col">{formatDuration(s.totalTimeMs)}</td>
                <td className="num-col">{s.attempted}</td>
                <td className="num-col">{s.solved}</td>
                <td className="num-col">{s.score === null ? '–' : `${s.points}/${s.maxPoints}`}</td>
                <td className="num-col">{formatPercent(s.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
