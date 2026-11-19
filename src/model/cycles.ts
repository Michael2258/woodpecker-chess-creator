import { attemptPoints } from './points'
import type { Attempt, Cycle, CycleSummary, Id, Puzzle, SessionSummary } from './types'

function totals(attempts: Attempt[]) {
  const attempted = attempts.length
  const solved = attempts.filter((a) => a.solved).length
  const totalTimeMs = attempts.reduce((sum, a) => sum + a.timeMs, 0)
  let points = 0
  let maxPoints = 0
  for (const a of attempts) {
    const p = attemptPoints(a)
    if (p) {
      points += p.points
      maxPoints += p.max
    }
  }
  return {
    attempted,
    solved,
    totalTimeMs,
    points,
    maxPoints,
    score: maxPoints ? points / maxPoints : null,
    days: solvingDays(attempts),
  }
}

/** Number of different calendar days (local time) on which any of these puzzles was solved. */
export function solvingDays(attempts: Attempt[]): number {
  const key = (t: number) => {
    const d = new Date(t)
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
  }
  return new Set(attempts.map((a) => key(a.attemptedAt))).size
}

/** The book's goal: keep cycling until a set is solved in one day, or for 7 cycles. */
export const GOAL_CYCLES = 7

export type WoodpeckerStatus =
  | { complete: false }
  | { complete: true; cycleNumber: number; reason: 'one-day' | 'cycles' }

export function woodpeckerStatus(cycles: Cycle[]): WoodpeckerStatus {
  const finished = cycles.filter((c) => c.completedAt !== null).sort((a, b) => a.number - b.number)
  for (const [i, c] of finished.entries()) {
    if (solvingDays(c.attempts) === 1) return { complete: true, cycleNumber: c.number, reason: 'one-day' }
    if (i + 1 >= GOAL_CYCLES) return { complete: true, cycleNumber: c.number, reason: 'cycles' }
  }
  return { complete: false }
}

export function woodpeckerMessage(status: WoodpeckerStatus): string | null {
  if (!status.complete) return null
  return status.reason === 'one-day'
    ? `Woodpecker complete: cycle ${status.cycleNumber} was solved in a single day.`
    : `Woodpecker complete: you've finished ${GOAL_CYCLES} cycles.`
}

export function summarizeCycle(cycle: Cycle): CycleSummary {
  const t = totals(cycle.attempts)
  return { cycleNumber: cycle.number, ...t, accuracy: t.attempted === 0 ? 0 : t.solved / t.attempted }
}

/** Attempts without a session id more than this far apart count as separate sessions. */
const LEGACY_SESSION_GAP_MS = 30 * 60 * 1000

/** The cycle's attempts grouped into solving sessions, oldest first. */
export function summarizeSessions(cycle: Cycle): SessionSummary[] {
  const sorted = [...cycle.attempts].sort((a, b) => a.attemptedAt - b.attemptedAt)
  const groups: { key: string; attempts: Attempt[] }[] = []
  let legacy: { key: string; attempts: Attempt[] } | null = null
  for (const a of sorted) {
    if (a.sessionId) {
      let g = groups.find((x) => x.key === a.sessionId)
      if (!g) groups.push((g = { key: a.sessionId, attempts: [] }))
      g.attempts.push(a)
      continue
    }
    const prev = legacy?.attempts.at(-1)
    if (!legacy || !prev || a.attemptedAt - a.timeMs - prev.attemptedAt > LEGACY_SESSION_GAP_MS) {
      legacy = { key: `legacy-${a.attemptedAt}`, attempts: [] }
      groups.push(legacy)
    }
    legacy.attempts.push(a)
  }
  return groups
    .map(({ key, attempts }) => ({
      key,
      startedAt: Math.min(...attempts.map((a) => a.attemptedAt - a.timeMs)),
      endedAt: Math.max(...attempts.map((a) => a.attemptedAt)),
      ...totals(attempts),
    }))
    .sort((a, b) => a.startedAt - b.startedAt)
}

/** Summary of one session's attempts in a cycle. */
export function summarizeSession(cycle: Cycle, sessionId: string): SessionSummary | null {
  return summarizeSessions(cycle).find((s) => s.key === sessionId) ?? null
}

export function formatPercent(fraction: number | null): string {
  return fraction === null ? '–' : `${Math.round(fraction * 100)}%`
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
