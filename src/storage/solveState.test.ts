import { describe, expect, it } from 'vitest'
import { loadPageState, loadRunState, savePageState, saveRunState, type RunState } from './solveState'

function memoryStorage(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  }
}

const run: RunState = {
  cycleId: 'c1',
  puzzleId: 'p2',
  startedAt: 1000,
  status: 'missed',
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  ply: 2,
  lastMove: { from: 'e2', to: 'e4' },
  wrong: { played: 'Qh5', expected: 'Nf3' },
  ownMove: null,
  solutionPly: 3,
  timeMs: 4200,
}

describe('solve state', () => {
  it('round-trips the page and the run for a set', () => {
    const s = memoryStorage()
    const page = { sessionId: 's1', pinned: 'c1', summaryFor: null, sessionReport: null }
    savePageState('set1', page, s)
    saveRunState('set1', run, s)
    expect(loadPageState('set1', s)).toEqual(page)
    expect(loadRunState('set1', 'c1', s)).toEqual(run)
  })

  it('ignores a run from another cycle or set', () => {
    const s = memoryStorage()
    saveRunState('set1', run, s)
    expect(loadRunState('set1', 'c2', s)).toBeNull()
    expect(loadRunState('set2', 'c1', s)).toBeNull()
    expect(loadPageState('set1', s)).toBeNull()
  })

  it('treats broken or missing storage as empty', () => {
    const s = memoryStorage()
    s.setItem('woodpecker:solve:set1:run', '{not json')
    expect(loadRunState('set1', 'c1', s)).toBeNull()
    expect(loadRunState('set1', 'c1', null)).toBeNull()
    expect(() => saveRunState('set1', run, null)).not.toThrow()
  })
})
