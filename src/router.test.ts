import { describe, expect, it } from 'vitest'
import { parseRoute, paths } from './router'

describe('parseRoute', () => {
  it('parses each route and round-trips the path helpers', () => {
    expect(parseRoute('')).toEqual({ name: 'home' })
    expect(parseRoute(paths.home())).toEqual({ name: 'home' })
    expect(parseRoute(paths.set('a b'))).toEqual({ name: 'set', setId: 'a b' })
    expect(parseRoute(paths.newPuzzle('s1'))).toEqual({ name: 'newPuzzle', setId: 's1' })
    expect(parseRoute(paths.editPuzzle('s1', 'p1'))).toEqual({ name: 'editPuzzle', setId: 's1', puzzleId: 'p1' })
    expect(parseRoute(paths.solve('s1'))).toEqual({ name: 'solve', setId: 's1' })
    expect(parseRoute('#/nope')).toEqual({ name: 'notFound' })
  })
})
