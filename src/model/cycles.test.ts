import { describe, expect, it } from 'vitest'
import {
  formatDuration,
  isCycleFinished,
  nextPuzzleInCycle,
  summarizeCycle,
  summarizeSessions,
  woodpeckerStatus,
} from './cycles'
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
    expect(s).toEqual({
      cycleNumber: 1, attempted: 2, solved: 1, accuracy: 0.5, totalTimeMs: 4000,
      points: 0, maxPoints: 0, score: null, days: 1,
    })
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

  it('adds up points from scored attempts only', () => {
    const s = summarizeCycle(cycle([
      { puzzleId: 'a', solved: true, timeMs: 1, attemptedAt: 0, firstMove: true, ticksSeen: [true, true] },
      { puzzleId: 'b', solved: false, timeMs: 1, attemptedAt: 0, firstMove: true, ticksSeen: [false] },
      { puzzleId: 'c', solved: false, timeMs: 1, attemptedAt: 0 },
    ]))
    expect([s.points, s.maxPoints, s.score]).toEqual([4, 5, 0.8])
  })

  it('groups attempts into sessions', () => {
    const min = 60_000
    const sessions = summarizeSessions(cycle([
      { puzzleId: 'a', solved: true, timeMs: min, attemptedAt: 10 * min, sessionId: 'x', firstMove: true, ticksSeen: [true] },
      { puzzleId: 'b', solved: false, timeMs: min, attemptedAt: 12 * min, sessionId: 'x', firstMove: false, ticksSeen: [false] },
      // Older attempts without a session id are split where there's a long gap.
      { puzzleId: 'c', solved: true, timeMs: min, attemptedAt: 1 * min },
      { puzzleId: 'd', solved: true, timeMs: min, attemptedAt: 2 * min },
      { puzzleId: 'e', solved: true, timeMs: min, attemptedAt: 100 * min },
    ]))
    expect(sessions.map((s) => [s.key, s.attempted, s.totalTimeMs / min, s.points, s.maxPoints])).toEqual([
      ['legacy-60000', 2, 2, 0, 0],
      ['x', 2, 2, 2, 4],
      ['legacy-6000000', 1, 1, 0, 0],
    ])
  })

  it('counts solving days and knows when the Woodpecker is complete', () => {
    const day = 24 * 3600_000
    const at = (d: number) => new Date(2026, 0, 1 + d, 12).getTime()
    const done = (n: number, days: number[]): Cycle => ({
      ...cycle(days.map((d, i) => ({ puzzleId: String(i), solved: true, timeMs: 1, attemptedAt: at(d) }))),
      id: `c${n}`, number: n, completedAt: at(days.at(-1)!) + day,
    })
    expect(summarizeCycle(done(1, [0, 0, 3])).days).toBe(2)
    expect(woodpeckerStatus([done(1, [0, 2]), done(2, [5, 6])])).toEqual({ complete: false })
    expect(woodpeckerStatus([done(1, [0, 2]), done(2, [5, 5])])).toEqual({ complete: true, cycleNumber: 2, reason: 'one-day' })
    const seven = [1, 2, 3, 4, 5, 6, 7].map((n) => done(n, [n * 3, n * 3 + 1]))
    expect(woodpeckerStatus(seven)).toEqual({ complete: true, cycleNumber: 7, reason: 'cycles' })
    expect(woodpeckerStatus(seven.slice(0, 6))).toEqual({ complete: false })
  })
})
