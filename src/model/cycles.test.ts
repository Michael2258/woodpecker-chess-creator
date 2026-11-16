import { describe, expect, it } from 'vitest'
import { formatDuration, isCycleFinished, nextPuzzleInCycle, summarizeCycle } from './cycles'
import type { Cycle, Puzzle } from './types'

const puzzle = (id: string, order: number): Puzzle => ({
  id, setId: 's', order, title: '', fen: '', solution: [], note: '', createdAt: 0, updatedAt: 0,
})
const cycle = (attempts: Cycle['attempts']): Cycle => ({
  id: 'c', setId: 's', number: 1, startedAt: 0, completedAt: null, attempts,
})

describe('cycles', () => {
  const puzzles = [puzzle('b', 1), puzzle('a', 0), puzzle('c', 2)]

  it('summarizes time and accuracy', () => {
    const s = summarizeCycle(cycle([
      { puzzleId: 'a', solved: true, timeMs: 1000, attemptedAt: 0 },
      { puzzleId: 'b', solved: false, timeMs: 3000, attemptedAt: 0 },
    ]))
    expect(s).toEqual({ cycleNumber: 1, attempted: 2, solved: 1, accuracy: 0.5, totalTimeMs: 4000 })
  })

  it('handles an empty cycle', () => {
    expect(summarizeCycle(cycle([])).accuracy).toBe(0)
  })

  it('finds the next unattempted puzzle in set order', () => {
    expect(nextPuzzleInCycle(cycle([]), puzzles)?.id).toBe('a')
    expect(nextPuzzleInCycle(cycle([{ puzzleId: 'a', solved: true, timeMs: 1, attemptedAt: 0 }]), puzzles)?.id).toBe('b')
  })

  it('knows when a cycle is finished', () => {
    const all = puzzles.map((p) => ({ puzzleId: p.id, solved: true, timeMs: 1, attemptedAt: 0 }))
    expect(isCycleFinished(cycle(all), puzzles)).toBe(true)
    expect(isCycleFinished(cycle([]), puzzles)).toBe(false)
    expect(isCycleFinished(cycle([]), [])).toBe(false)
  })
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(42_400)).toBe('0:42')
    expect(formatDuration(725_000)).toBe('12:05')
    expect(formatDuration(3_729_000)).toBe('1:02:09')
  })
})
