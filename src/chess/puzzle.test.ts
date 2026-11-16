import { describe, expect, it } from 'vitest'
import {
  checkSolverMove,
  fenAfter,
  formatLine,
  normalizeSolution,
  parsePuzzleInput,
  solverColor,
} from './puzzle'

// White to move: Qxf7# (Scholar's mate pattern).
const SCHOLAR = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
// Black to move: ...Rd1 forces Rxd1.
const BACK_RANK = '3r2k1/5ppp/8/8/8/8/5PPP/4R1K1 b - - 0 1'

describe('parsePuzzleInput', () => {
  it('accepts a bare FEN with no solution', () => {
    const r = parsePuzzleInput(SCHOLAR)
    expect(r).toEqual({ ok: true, puzzle: { fen: SCHOLAR, solution: [] } })
  })

  it('reads a PGN with a FEN header and returns the start position and moves', () => {
    const pgn = `[SetUp "1"]\n[FEN "${BACK_RANK}"]\n\n1... Rd1 2. Rxd1 *`
    const r = parsePuzzleInput(pgn)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.puzzle.fen).toBe(BACK_RANK)
      expect(r.puzzle.solution).toEqual(['Rd1', 'Rxd1'])
    }
  })

  it('reads a PGN from the initial position', () => {
    const r = parsePuzzleInput('1. e4 e5 2. Nf3 *')
    expect(r.ok && r.puzzle.solution).toEqual(['e4', 'e5', 'Nf3'])
  })

  it('rejects empty and garbage input', () => {
    expect(parsePuzzleInput('  ').ok).toBe(false)
    expect(parsePuzzleInput('not chess at all').ok).toBe(false)
  })
})

describe('normalizeSolution', () => {
  it('normalizes coordinate moves to SAN', () => {
    const r = normalizeSolution(SCHOLAR, ['h5f7'])
    expect(r.ok && r.puzzle.solution).toEqual(['Qxf7#'])
  })

  it('reports which move is illegal', () => {
    const r = normalizeSolution(SCHOLAR, ['Qxf7', 'e5'])
    expect(r).toEqual({ ok: false, error: expect.stringContaining('Move 2') })
  })
})

describe('solverColor', () => {
  it('is the side to move', () => {
    expect(solverColor(SCHOLAR)).toBe('white')
    expect(solverColor(BACK_RANK)).toBe('black')
  })
})

describe('checkSolverMove', () => {
  const fen = BACK_RANK

  it('plays the reply after a correct move', () => {
    const r = checkSolverMove(fen, ['Rd1', 'Rxd1'], 0, { from: 'd8', to: 'd1' })
    expect(r).toMatchObject({ result: 'correct', reply: 'Rxd1', nextPly: 2, solved: true })
  })

  it('flags a wrong move and says what was expected', () => {
    const r = checkSolverMove(fen, ['Rd1', 'Rxd1'], 0, { from: 'g8', to: 'f8' })
    expect(r).toEqual({ result: 'wrong', expected: 'Rd1' })
  })

  it('flags an illegal move', () => {
    expect(checkSolverMove(fen, ['Rd1', 'Rxd1'], 0, { from: 'd8', to: 'a1' })).toEqual({ result: 'illegal' })
  })

  it('accepts any checkmate even if the book gives another move', () => {
    // Qxf7# mates, but the stored line lists a different first move.
    const r = checkSolverMove(SCHOLAR, ['Bxf7+'], 0, { from: 'h5', to: 'f7' })
    expect(r).toMatchObject({ result: 'correct', solved: true })
  })
})

describe('formatLine and fenAfter', () => {
  it('numbers moves from the position, including black to move', () => {
    expect(formatLine(BACK_RANK, ['Rd1', 'Rxd1'])).toBe('1... Rd1 2. Rxd1')
    expect(formatLine(SCHOLAR, ['Qxf7#'])).toBe('4. Qxf7#')
    expect(formatLine(SCHOLAR, [])).toBe('')
  })

  it('plays a line forward', () => {
    expect(fenAfter(BACK_RANK, ['Rd1']).split(' ')[0]).toBe('6k1/5ppp/8/8/8/8/5PPP/3rR1K1')
  })
})
