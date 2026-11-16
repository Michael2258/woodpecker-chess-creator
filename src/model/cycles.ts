import type { Cycle, CycleSummary, Id, Puzzle } from './types'

export function summarizeCycle(cycle: Cycle): CycleSummary {
  const attempted = cycle.attempts.length
  const solved = cycle.attempts.filter((a) => a.solved).length
  const totalTimeMs = cycle.attempts.reduce((sum, a) => sum + a.timeMs, 0)
  return {
    cycleNumber: cycle.number,
    attempted,
    solved,
    accuracy: attempted === 0 ? 0 : solved / attempted,
    totalTimeMs,
  }
}

/** The next puzzle in set order that this cycle has no attempt for yet. */
export function nextPuzzleInCycle(cycle: Cycle, puzzles: Puzzle[]): Puzzle | null {
  const done = new Set<Id>(cycle.attempts.map((a) => a.puzzleId))
  const ordered = [...puzzles].sort((a, b) => a.order - b.order)
  return ordered.find((p) => !done.has(p.id)) ?? null
}

export function isCycleFinished(cycle: Cycle, puzzles: Puzzle[]): boolean {
  return puzzles.length > 0 && nextPuzzleInCycle(cycle, puzzles) === null
}

/** "0:42", "12:05", "1:02:09". */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
