import { describe, expect, it } from 'vitest'
import { countBackup, exportBackup, parseBackup, restoreBackup } from './backup'
import { WoodpeckerDB } from './db'
import { createRepository } from './repository'

const FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
const freshDb = () => new WoodpeckerDB(`test-${crypto.randomUUID()}`)

describe('backup', () => {
  it('moves sets, notes, cycles and attempts to another device', async () => {
    const phone = freshDb()
    const computer = freshDb()
    const a = createRepository(computer)
    const set = await a.createSet('Easy')
    const p = await a.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'], title: '#1', note: 'mate on f7' })
    const cycle = await a.startCycle(set.id)
    await a.recordAttempt(cycle.id, { puzzleId: p.id, solved: true, timeMs: 4200, sessionId: 's1', firstMove: true, ticksSeen: [true] })

    // The phone already had something; restoring replaces it.
    await createRepository(phone).createSet('Old phone set')

    const text = JSON.stringify(await exportBackup(computer))
    const backup = parseBackup(text)
    expect(countBackup(backup)).toEqual({ sets: 1, puzzles: 1, cycles: 1, attempts: 1 })
    await restoreBackup(phone, backup)

    const b = createRepository(phone)
    expect((await b.listSets()).map((s) => s.name)).toEqual(['Easy'])
    expect((await b.listPuzzles(set.id))[0].note).toBe('mate on f7')
    const cycles = await b.listCycles(set.id)
    expect(cycles[0].attempts[0]).toMatchObject({ solved: true, timeMs: 4200, sessionId: 's1' })
    expect(cycles[0].completedAt).not.toBeNull()
  })

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('# not json')).toThrow(/not JSON/)
    expect(() => parseBackup('{"hello":1}')).toThrow(/not a Woodpecker backup/)
    expect(() => parseBackup('{"app":"woodpecker","version":2,"sets":[],"puzzles":[],"cycles":[]}')).toThrow(/newer/)
    expect(() => parseBackup('{"app":"woodpecker","version":1,"sets":[{}],"puzzles":[],"cycles":[]}')).toThrow(/damaged/)
  })

  it('leaves the device untouched when a restore fails', async () => {
    const db = freshDb()
    await createRepository(db).createSet('Keep me')
    const dup = { id: 'x', name: 'A', description: '', createdAt: 1, updatedAt: 1 }
    const backup = parseBackup(JSON.stringify({ app: 'woodpecker', version: 1, exportedAt: 1, sets: [dup, dup], puzzles: [], cycles: [] }))
    await expect(restoreBackup(db, backup)).rejects.toThrow()
    expect((await createRepository(db).listSets()).map((s) => s.name)).toEqual(['Keep me'])
  })
})
