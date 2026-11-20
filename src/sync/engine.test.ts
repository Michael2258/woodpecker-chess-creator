import { beforeEach, describe, expect, it } from 'vitest'
import { WoodpeckerDB } from '../storage/db'
import { createRepository } from '../storage/repository'
import { syncOnce, type OutgoingRow, type Remote, type RemoteRow } from './engine'

const FEN = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'

/** The cloud table, kept in memory. */
class FakeCloud {
  rows = new Map<string, RemoteRow>()
  tick = 0
  forUser(): Remote {
    return {
      pull: async (since) =>
        [...this.rows.values()]
          .filter((r) => since === null || r.serverUpdatedAt >= since)
          .sort((a, b) => a.serverUpdatedAt.localeCompare(b.serverUpdatedAt)),
      push: async (rows: OutgoingRow[]) => {
        for (const r of rows) {
          const t = new Date(Date.UTC(2026, 0, 1) + ++this.tick * 1000).toISOString()
          this.rows.set(`${r.kind}:${r.id}`, { ...structuredClone(r), serverUpdatedAt: t })
        }
      },
    }
  }
}

let cloud: FakeCloud
let clock: number
const device = () => {
  const db = new WoodpeckerDB(`test-${crypto.randomUUID()}`)
  return { db, repo: createRepository(db, () => ++clock), sync: () => syncOnce(db, cloud.forUser(), 'user-1') }
}

beforeEach(() => {
  cloud = new FakeCloud()
  clock = 1000
})

describe('sync', () => {
  it('moves sets, puzzles, notes and progress from computer to phone', async () => {
    const computer = device()
    const phone = device()
    const set = await computer.repo.createSet('Easy')
    const p = await computer.repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'], note: 'mate' })
    const c = await computer.repo.startCycle(set.id)
    await computer.repo.recordAttempt(c.id, { puzzleId: p.id, solved: true, timeMs: 3000 })
    expect(await computer.sync()).toMatchObject({ pushed: 3 })

    await phone.sync()
    expect((await phone.repo.listSets()).map((s) => s.name)).toEqual(['Easy'])
    expect((await phone.repo.listPuzzles(set.id))[0].note).toBe('mate')
    expect((await phone.repo.listCycles(set.id))[0].attempts).toHaveLength(1)

    // Nothing changed: nothing more to send either way.
    expect(await phone.sync()).toEqual({ pulled: 0, pushed: 0 })
    expect(await computer.sync()).toEqual({ pulled: 0, pushed: 0 })
  })

  it('carries edits and deletes both ways', async () => {
    const a = device()
    const b = device()
    const set = await a.repo.createSet('S')
    const p1 = await a.repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    const p2 = await a.repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    await a.sync()
    await b.sync()

    await b.repo.updatePuzzle(p1.id, { note: 'from phone' })
    await b.repo.deletePuzzle(p2.id)
    await b.sync()
    await a.sync()
    const puzzles = await a.repo.listPuzzles(set.id)
    expect(puzzles.map((p) => [p.id, p.note])).toEqual([[p1.id, 'from phone']])

    await a.repo.deleteSet(set.id)
    await a.sync()
    await b.sync()
    expect(await b.repo.listSets()).toEqual([])
    expect(await b.repo.listPuzzles(set.id)).toEqual([])
  })

  it('a delete made here is not undone by our own upload coming back', async () => {
    const a = device()
    const set = await a.repo.createSet('S')
    await a.sync()
    await a.repo.deleteSet(set.id)
    await a.sync()
    await a.sync()
    expect(await a.repo.listSets()).toEqual([])
  })

  it('keeps puzzles solved on both devices in the same cycle while offline', async () => {
    const a = device()
    const b = device()
    const set = await a.repo.createSet('S')
    const p1 = await a.repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    const p2 = await a.repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    const c = await a.repo.startCycle(set.id)
    await a.sync()
    await b.sync()

    await a.repo.recordAttempt(c.id, { puzzleId: p1.id, solved: true, timeMs: 1000 })
    await b.repo.recordAttempt(c.id, { puzzleId: p2.id, solved: false, timeMs: 2000 })
    await a.sync()
    await b.sync()
    await a.sync()
    for (const d of [a, b]) {
      const cycle = await d.repo.getCycle(c.id)
      expect(cycle?.attempts.map((x) => x.puzzleId).sort()).toEqual([p1.id, p2.id].sort())
    }
  })

  it('keeps the newer edit when both devices edit the same puzzle', async () => {
    const a = device()
    const b = device()
    const set = await a.repo.createSet('S')
    const p = await a.repo.addPuzzle(set.id, { fen: FEN, solution: ['Qxf7#'] })
    await a.sync()
    await b.sync()
    await a.repo.updatePuzzle(p.id, { note: 'older' })
    await b.repo.updatePuzzle(p.id, { note: 'newer' })
    await a.sync()
    await b.sync()
    await a.sync()
    expect((await a.repo.listPuzzles(set.id))[0].note).toBe('newer')
    expect((await b.repo.listPuzzles(set.id))[0].note).toBe('newer')
  })

  it('uploads what was already on a device the first time it signs in', async () => {
    const phone = device()
    await phone.repo.createSet('Made offline')
    const computer = device()
    await computer.repo.createSet('From computer')
    await computer.sync()
    await phone.sync()
    await computer.sync()
    for (const d of [phone, computer]) {
      expect((await d.repo.listSets()).map((s) => s.name).sort()).toEqual(['From computer', 'Made offline'])
    }
  })
})
