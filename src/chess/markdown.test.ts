import { describe, expect, it } from 'vitest'
import steinitz1to6 from '../../test/fixtures/steinitz-1-6.md?raw'
import steinitz7to12 from '../../test/fixtures/steinitz-7-12.md?raw'
import { parseMarkdownPuzzles } from './markdown'

describe('parseMarkdownPuzzles', () => {
  it('reads every puzzle from steinitz-1-6.md', () => {
    const result = parseMarkdownPuzzles(steinitz1to6)
    expect(result.name).toBe('Woodpecker puzzles 1 to 6 (Steinitz)')
    expect(result.skipped).toEqual([])
    expect(result.puzzles).toHaveLength(6)
    expect(result.puzzles[0]).toEqual({
      title: '1. Hamppe – Steinitz, Vienna 1860',
      note: 'Black would have been lost without this resource.',
      fen: 'r6r/1pp3k1/1b6/p2P1p2/P1N1pn2/2P2PP1/BP5P/4RR1K b - - 0 30',
      solution: ['Rxh2+', 'Kxh2', 'Rh8#'],
    })
    // "(none)" means no note.
    expect(result.puzzles[1].note).toBe('')
    expect(result.puzzles[1].solution).toEqual(['Rf8+', 'Bxf8', 'd6+', 'Be6', 'Bxe6#'])
    expect(result.puzzles.map((p) => p.title.split('.')[0])).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('reads steinitz-7-12.md and skips the puzzle without a solution', () => {
    const result = parseMarkdownPuzzles(steinitz7to12)
    expect(result.puzzles.map((p) => p.title.split('.')[0])).toEqual(['7', '8', '9', '10', '12'])
    expect(result.puzzles[0].note).toContain('27...Rxc4?!')
    expect(result.puzzles[0].solution).toEqual(['f3', 'Qxf3', 'Rxc4'])
    expect(result.skipped).toEqual([
      { heading: '11. Steinitz – Meitner, Vienna 1882 (not included)', reason: 'No solution moves, only a position.' },
    ])
  })

  it('falls back to the heading for the title and joins multi-line notes', () => {
    const md = [
      '## Smothered mate',
      '**Note:** first line',
      'second line',
      '',
      '```',
      '[FEN "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1"]',
      '',
      '1. Nf7#',
      '```',
    ].join('\n')
    expect(parseMarkdownPuzzles(md).puzzles).toEqual([
      { title: 'Smothered mate', note: 'first line second line', fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1', solution: ['Nf7#'] },
    ])
  })

  it('reports illegal moves and missing blocks', () => {
    const md = '## A\n\nno block here\n\n## B\n\n```\n[FEN "6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1"]\n\n1. Qh7#\n```\n'
    const result = parseMarkdownPuzzles(md)
    expect(result.puzzles).toEqual([])
    expect(result.skipped.map((s) => s.heading)).toEqual(['A', 'B'])
    expect(result.skipped[0].reason).toBe('No FEN or PGN block.')
  })
})
