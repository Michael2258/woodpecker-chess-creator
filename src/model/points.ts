import { linePlies } from '../chess/puzzle'
import type { Attempt } from './types'

/**
 * Scoring from The Woodpecker Method:
 *   finding the correct first move = 1 point
 *   finding each move marked with a ✓ ("tick") in the solution = 1 point
 *
 * A puzzle lists its ticked moves as labels like "40.Kxb5" or "31...Rh8#".
 * A tick can be on a move of the stored line, or in a side line the book
 * also expects you to see (for example another defence).
 */

export interface Tick {
  /** Move with its number, e.g. "40.Kxb5". */
  label: string
  /** Index of this move in the puzzle's solution, or null when it's in a side line. */
  ply: number | null
}

/** Splits a "40.Kxb5, 41.Kb5" list into labels. */
export function parseTickList(text: string): string[] {
  return text
    .split(/[,;\n]/)
    .map((s) => s.trim().replace(/\s+/g, ''))
    .filter(Boolean)
}

export function formatTickList(ticks: string[]): string {
  return ticks.join(', ')
}

const bare = (san: string) => san.replace(/[+#!?]/g, '')

function splitLabel(label: string): { num: number | null; black: boolean | null; san: string } {
  const m = label.match(/^(\d+)\s*(\.\.\.|…|\.)\s*(.+)$/)
  if (!m) return { num: null, black: null, san: bare(label) }
  return { num: Number(m[1]), black: m[2] !== '.', san: bare(m[3]) }
}

/**
 * The puzzle's ticked moves, matched to its solution line. With no ticks
 * given, the last move of the line is the ticked one (the book's lines end
 * at the last move you are expected to see).
 */
export function resolveTicks(fen: string, solution: string[], ticks: string[] | undefined): Tick[] {
  const plies = linePlies(fen, solution)
  // Move number and side of every ply.
  const [, turn, , , , full] = fen.split(' ')
  let num = Number(full) || 1
  let black = turn === 'b'
  const info = plies.map((p) => {
    const r = { num, black, san: bare(p.san) }
    if (black) num++
    black = !black
    return r
  })
  const labelOf = (i: number) =>
    `${info[i].num}${info[i].black ? '...' : '.'}${plies[i].san}`

  if (!ticks || ticks.length === 0) {
    return plies.length ? [{ label: labelOf(plies.length - 1), ply: plies.length - 1 }] : []
  }
  return ticks.map((label) => {
    const t = splitLabel(label)
    let ply = info.findIndex((p) => p.san === t.san && (t.num === null || (p.num === t.num && p.black === t.black)))
    if (t.num === null && info.filter((p) => p.san === t.san).length !== 1) ply = -1
    return { label, ply: ply >= 0 ? ply : null }
  })
}

/** What the solver earned on one puzzle. */
export interface Score {
  firstMove: boolean
  /** One entry per tick, in the puzzle's order. */
  ticks: boolean[]
}

/**
 * The score suggested from what happened on the board. `wrongPly` is the
 * index of the solver's first wrong move (0 when they gave up straight away),
 * or null when the puzzle was solved.
 *
 * A ticked move in the line counts when the solver got that far: their own
 * move was played correctly, or, for an opponent's move, they answered it
 * correctly. Side-line ticks can't be checked on the board, so they count
 * when the whole puzzle was solved. The solver can change any of these.
 */
export function suggestScore(ticks: Tick[], wrongPly: number | null): Score {
  const solved = wrongPly === null
  return {
    firstMove: solved || wrongPly > 0,
    ticks: ticks.map((t) => {
      if (solved) return true
      if (t.ply === null) return false
      const needed = t.ply % 2 === 0 ? t.ply : t.ply + 1
      return needed < wrongPly
    }),
  }
}

export function scorePoints(s: Score): number {
  return (s.firstMove ? 1 : 0) + s.ticks.filter(Boolean).length
}

export function maxPoints(tickCount: number): number {
  return 1 + tickCount
}

/** Points for an attempt, or null for attempts recorded before scoring existed. */
export function attemptPoints(a: Attempt): { points: number; max: number } | null {
  if (a.firstMove === undefined || !a.ticksSeen) return null
  return { points: scorePoints({ firstMove: a.firstMove, ticks: a.ticksSeen }), max: maxPoints(a.ticksSeen.length) }
}
