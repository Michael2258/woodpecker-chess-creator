import { beforeEach, describe, expect, it } from 'vitest'
import { WoodpeckerDB } from './db'
import { createRepository, type Repository } from './repository'

const FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'

let repo: Repository
let clock = 0

beforeEach(async () => {
  const db = new WoodpeckerDB(`test-${crypto.randomUUID()}`)
  clock = 0
  repo = createRepository(db, () => ++clock)
})

describe('repository', () => {
  it('creates, lists, renames and deletes sets', async () => {
    const a = await repo.createSet('Simple')
    const b = await repo.createSet(' Intermediate ')
    expect(b.name).toBe('Intermediate')
    expect((await repo.listSets()).map((s) => s.id)).toEqual([b.id, a.id])

    await repo.updateSet(a.id, { name: 'Easy' })
    expect((await repo.getSet(a.id))?.name).toBe('Easy')

    await repo.deleteSet(a.id)
    expect((await repo.listSets()).map((s) => s.id)).toEqual([b.id])
  })

  it('rejects a set without a name', async () => {
    await expect(repo.createSet('   ')).rejects.toThrow()
  })

  it('adds puzzles in order and keeps notes', async () => {
    const set = await repo.createSet('S')
    const p1 = await repo.addPuzzle(set.id, { fen: FEN, solution: ['h5f7'], title: '#1', note: 'mate' })
    const p2 = await repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    expect(p1.solution).toEqual(['Qxf7#'])
    expect((await repo.listPuzzles(set.id)).map((p) => [p.id, p.order, p.note])).toEqual([
      [p1.id, 0, 'mate'],
      [p2.id, 1, ''],
    ])
  })

  it('rejects puzzles with an illegal or empty solution', async () => {
    const set = await repo.createSet('S')
    await expect(repo.addPuzzle(set.id, { fen: FEN, solution: ['e5'] })).rejects.toThrow(/Move 1/)
    await expect(repo.addPuzzle(set.id, { fen: FEN, solution: [] })).rejects.toThrow()
  })

  it('updates, reorders and deletes puzzles', async () => {
    const set = await repo.createSet('S')
    const ids = []
    for (let i = 0; i < 3; i++) ids.push((await repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })).id)

    await repo.updatePuzzle(ids[0], { note: 'remember the f7 weakness' })
    await repo.reorderPuzzles(set.id, [ids[2], ids[0], ids[1]])
    let list = await repo.listPuzzles(set.id)
    expect(list.map((p) => p.id)).toEqual([ids[2], ids[0], ids[1]])
    expect(list[1].note).toBe('remember the f7 weakness')

    await repo.deletePuzzle(ids[0])
    list = await repo.listPuzzles(set.id)
    expect(list.map((p) => [p.id, p.order])).toEqual([[ids[2], 0], [ids[1], 1]])

    await expect(repo.reorderPuzzles(set.id, [ids[2]])).rejects.toThrow()
  })

  it('runs cycles and marks them complete once every puzzle is attempted', async () => {
    const set = await repo.createSet('S')
    const p1 = await repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    const p2 = await repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })

    const c1 = await repo.startCycle(set.id)
    expect(c1.number).toBe(1)
    let c = await repo.recordAttempt(c1.id, { puzzleId: p1.id, solved: true, timeMs: 5000 })
    expect(c.completedAt).toBeNull()
    c = await repo.recordAttempt(c1.id, { puzzleId: p2.id, solved: false, timeMs: 9000 })
    expect(c.completedAt).not.toBeNull()

    const c2 = await repo.startCycle(set.id)
    expect(c2.number).toBe(2)
    expect((await repo.listCycles(set.id)).map((x) => x.number)).toEqual([1, 2])

    await repo.deleteSet(set.id)
    expect(await repo.listCycles(set.id)).toEqual([])
    expect(await repo.listPuzzles(set.id)).toEqual([])
  })
})
