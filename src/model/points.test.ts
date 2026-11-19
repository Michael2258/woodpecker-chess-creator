import { describe, expect, it } from 'vitest'
import { parseTickList, resolveTicks, suggestScore } from './points'

// A made-up line: 39.Rxd7 Kxd7 40.cxb5 ✓, with a side-line tick 41.Kb5.
const FEN = '4k3/3r4/8/1p6/2P5/8/8/K2R4 w - - 0 39'

describe('points', () => {
  it('parses a tick list', () => {
    expect(parseTickList(' 41.Kb5, 40. Kxb5 ;31...Rh8#\n')).toEqual(['41.Kb5', '40.Kxb5', '31...Rh8#'])
    expect(parseTickList('')).toEqual([])
  })

  it('matches ticks to the line, and leaves side-line ticks unmatched', () => {
    const line = ['Rxd7', 'Kxd7', 'cxb5']
    expect(resolveTicks(FEN, line, ['41.Kb5', '40.cxb5'])).toEqual([
      { label: '41.Kb5', ply: null },
      { label: '40.cxb5', ply: 2 },
    ])
    // Same move but for the other side or another move number does not match.
    expect(resolveTicks(FEN, line, ['40...cxb5'])[0].ply).toBeNull()
    // Without a move number, a unique move in the line still matches.
    expect(resolveTicks(FEN, line, ['Kxd7'])[0].ply).toBe(1)
  })

  it('treats the last move as ticked when none are given', () => {
    expect(resolveTicks(FEN, ['Rxd7', 'Kxd7', 'cxb5'], undefined)).toEqual([{ label: '40.cxb5', ply: 2 }])
    expect(resolveTicks(FEN, ['Rxd7'], [])).toEqual([{ label: '39.Rxd7', ply: 0 }])
  })

  it('suggests a score from how far the solver got', () => {
    const ticks = [
      { label: 'a', ply: 1 }, // opponent move: needs the answer at ply 2
      { label: 'b', ply: 2 },
      { label: 'c', ply: 4 },
      { label: 'side', ply: null },
    ]
    expect(suggestScore(ticks, null)).toEqual({ firstMove: true, ticks: [true, true, true, true] })
    expect(suggestScore(ticks, 0)).toEqual({ firstMove: false, ticks: [false, false, false, false] })
    expect(suggestScore(ticks, 2)).toEqual({ firstMove: true, ticks: [false, false, false, false] })
    expect(suggestScore(ticks, 4)).toEqual({ firstMove: true, ticks: [true, true, false, false] })
  })
})
