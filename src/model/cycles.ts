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
