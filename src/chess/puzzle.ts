import { Chess, validateFen } from 'chess.js'

export type Color = 'white' | 'black'

export interface ParsedPuzzle {
  fen: string
  /** Solution in SAN. Empty when only a position was given. */
  solution: string[]
}

export type ParseResult = { ok: true; puzzle: ParsedPuzzle } | { ok: false; error: string }

/** Which side the solver plays, which is the side to move in the start position. */
export function solverColor(fen: string): Color {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white'
}

/**
 * Checks that every move in the line is legal from the position, and returns
 * the moves in standard SAN (so "Nf3" and "Ng1f3"-style input end up the same).
 */
export function normalizeSolution(fen: string, moves: string[]): ParseResult {
  const fenCheck = validateFen(fen)
  if (!fenCheck.ok) return { ok: false, error: `Invalid FEN: ${fenCheck.error}` }
  const chess = new Chess(fen)
  const solution: string[] = []
  for (const [i, raw] of moves.entries()) {
    try {
      solution.push(chess.move(raw).san)
    } catch {
      return { ok: false, error: `Move ${i + 1} ("${raw}") is not legal in this position.` }
    }
  }
  return { ok: true, puzzle: { fen: new Chess(fen).fen(), solution } }
}

/**
 * Accepts either a bare FEN, or a PGN (with a [FEN] header when the puzzle
 * does not start from the initial position). Move numbers, comments and
 * results in the PGN are handled by chess.js.
 */
export function parsePuzzleInput(input: string): ParseResult {
  const text = input.trim()
  if (!text) return { ok: false, error: 'Paste a FEN or a PGN.' }

  if (validateFen(text).ok) {
    return { ok: true, puzzle: { fen: new Chess(text).fen(), solution: [] } }
  }

  const chess = new Chess()
  try {
    chess.loadPgn(text)
  } catch (e) {
    const looksLikeFen = /^[pnbrqkPNBRQK1-8/]+\s+[wb]\b/.test(text)
    const detail = looksLikeFen ? validateFen(text).error : (e as Error).message
    return { ok: false, error: `Could not read this as a FEN or PGN: ${detail}` }
  }
  return { ok: true, puzzle: { fen: startFen(chess), solution: chess.history() } }
}

function startFen(chess: Chess): string {
  return chess.history({ verbose: true })[0]?.before ?? chess.fen()
}

export interface MoveInput {
  from: string
  to: string
  promotion?: string
}

export type MoveCheck =
  | { result: 'wrong'; expected: string }
  | {
      result: 'correct'
      /** Position after the solver's move and the opponent's reply, if any. */
      fen: string
      /** The opponent's reply in SAN, or null when there is none. */
      reply: string | null
      /** Index in the solution of the solver's next move. */
      nextPly: number
      solved: boolean
    }
  | { result: 'illegal' }

/**
 * Checks the solver's move at `ply` (an even index into the solution) and,
 * when it is right, plays the opponent's reply too.
 */
export function checkSolverMove(
  fen: string,
  solution: string[],
  ply: number,
  move: MoveInput,
): MoveCheck {
  const chess = new Chess(fen)
  let played
  try {
    played = chess.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' })
  } catch {
    return { result: 'illegal' }
  }
  const expected = solution[ply]
  // Any mating move counts, since mate is mate even if the book gives another.
  if (played.san !== expected && !chess.isCheckmate()) {
    return { result: 'wrong', expected }
  }
  const replySan = solution[ply + 1] ?? null
  if (replySan && !chess.isGameOver()) chess.move(replySan)
  const nextPly = ply + 2
  return {
    result: 'correct',
    fen: chess.fen(),
    reply: replySan,
    nextPly,
    solved: nextPly >= solution.length || chess.isCheckmate(),
  }
}

/** Position after playing `moves` (SAN) from `fen`. */
export function fenAfter(fen: string, moves: string[]): string {
  const chess = new Chess(fen)
  for (const m of moves) chess.move(m)
  return chess.fen()
}

/** Formats a line with move numbers, e.g. "23... Rd1+ 24. Rxd1 Qxd1#". */
export function formatLine(fen: string, moves: string[]): string {
  const [, turn, , , , full] = fen.split(' ')
  let moveNo = Number(full) || 1
  let white = turn !== 'b'
  const parts: string[] = []
  moves.forEach((san, i) => {
    if (white) parts.push(`${moveNo}. ${san}`)
    else parts.push(i === 0 ? `${moveNo}... ${san}` : san)
    if (!white) moveNo++
    white = !white
  })
  return parts.join(' ')
}
