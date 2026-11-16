import { formatDuration, summarizeCycle } from '../model/cycles'
import type { Cycle } from '../model/types'

/** Table of finished cycles, so progress across cycles is easy to compare. */
export function CycleHistory({ cycles }: { cycles: Cycle[] }) {
  const done = cycles.filter((c) => c.completedAt !== null)
  if (done.length === 0) return null
  return (
    <section className="card">
      <h3>Finished cycles</h3>
      <div className="table-scroll">
        <table className="cycles">
          <thead>
            <tr>
              <th>Cycle</th>
              <th>Finished</th>
              <th className="num-col">Time</th>
              <th className="num-col">Solved</th>
              <th className="num-col">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {done.map((c) => {
              const s = summarizeCycle(c)
              return (
                <tr key={c.id}>
                  <td>{c.number}</td>
                  <td>{new Date(c.completedAt!).toLocaleDateString()}</td>
                  <td className="num-col">{formatDuration(s.totalTimeMs)}</td>
                  <td className="num-col">
                    {s.solved}/{s.attempted}
                  </td>
                  <td className="num-col">{Math.round(s.accuracy * 100)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
