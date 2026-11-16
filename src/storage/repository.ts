import Dexie from 'dexie'
import type { Attempt, Cycle, Id, Puzzle, PuzzleSet } from '../model/types'
import { normalizeSolution } from '../chess/puzzle'
import type { WoodpeckerDB } from './db'

const newId = (): Id => crypto.randomUUID()

/** All reads and writes go through here, so the UI never touches tables directly. */
export function createRepository(db: WoodpeckerDB, now: () => number = Date.now) {
  return {
    // ---- Sets ----
    async listSets(): Promise<PuzzleSet[]> {
      return db.sets.orderBy('updatedAt').reverse().toArray()
    },

    async getSet(id: Id): Promise<PuzzleSet | undefined> {
      return db.sets.get(id)
    },

    async createSet(name: string, description = ''): Promise<PuzzleSet> {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('A set needs a name.')
      const t = now()
      const set: PuzzleSet = { id: newId(), name: trimmed, description, createdAt: t, updatedAt: t }
      await db.sets.add(set)
      return set
    },

    async updateSet(id: Id, changes: Partial<Pick<PuzzleSet, 'name' | 'description'>>) {
      if (changes.name !== undefined && !changes.name.trim()) throw new Error('A set needs a name.')
      await db.sets.update(id, { ...changes, updatedAt: now() })
    },

    /** Deletes the set with all its puzzles and training history. */
    async deleteSet(id: Id) {
      await db.transaction('rw', db.sets, db.puzzles, db.cycles, async () => {
        await db.puzzles.where('setId').equals(id).delete()
        await db.cycles.where('setId').equals(id).delete()
        await db.sets.delete(id)
      })
    },

    // ---- Puzzles ----
    async listPuzzles(setId: Id): Promise<Puzzle[]> {
      return db.puzzles.where('[setId+order]').between([setId, Dexie.minKey], [setId, Dexie.maxKey]).toArray()
    },

    async addPuzzle(
      setId: Id,
      input: { fen: string; solution: string[]; title?: string; note?: string },
    ): Promise<Puzzle> {
      const parsed = normalizeSolution(input.fen, input.solution)
      if (!parsed.ok) throw new Error(parsed.error)
      if (parsed.puzzle.solution.length === 0) throw new Error('A puzzle needs at least one solution move.')
      const t = now()
      return db.transaction('rw', db.sets, db.puzzles, async () => {
        const order = await db.puzzles.where('setId').equals(setId).count()
        const puzzle: Puzzle = {
          id: newId(),
          setId,
          order,
          title: input.title?.trim() ?? '',
          fen: parsed.puzzle.fen,
          solution: parsed.puzzle.solution,
          note: input.note ?? '',
          createdAt: t,
          updatedAt: t,
        }
        await db.puzzles.add(puzzle)
        await db.sets.update(setId, { updatedAt: t })
        return puzzle
      })
    },

    async updatePuzzle(
      id: Id,
      changes: Partial<Pick<Puzzle, 'fen' | 'solution' | 'title' | 'note'>>,
    ) {
      const existing = await db.puzzles.get(id)
      if (!existing) throw new Error('Puzzle not found.')
      const update: Partial<Puzzle> = { ...changes, updatedAt: now() }
      if (changes.fen !== undefined || changes.solution !== undefined) {
        const parsed = normalizeSolution(changes.fen ?? existing.fen, changes.solution ?? existing.solution)
        if (!parsed.ok) throw new Error(parsed.error)
        update.fen = parsed.puzzle.fen
        update.solution = parsed.puzzle.solution
      }
      await db.puzzles.update(id, update)
    },

    /** Removes a puzzle and closes the gap in the order of the rest. */
    async deletePuzzle(id: Id) {
      await db.transaction('rw', db.puzzles, async () => {
        const puzzle = await db.puzzles.get(id)
        if (!puzzle) return
        await db.puzzles.delete(id)
        const rest = await this.listPuzzles(puzzle.setId)
        await Promise.all(rest.map((p, i) => db.puzzles.update(p.id, { order: i })))
      })
    },

    /** Sets the order of a set's puzzles to match `orderedIds`. */
    async reorderPuzzles(setId: Id, orderedIds: Id[]) {
      await db.transaction('rw', db.puzzles, async () => {
        const current = await this.listPuzzles(setId)
        const same =
          current.length === orderedIds.length && current.every((p) => orderedIds.includes(p.id))
        if (!same) throw new Error('The new order must list every puzzle in the set exactly once.')
        await Promise.all(orderedIds.map((id, i) => db.puzzles.update(id, { order: i })))
      })
    },

    // ---- Cycles ----
    async listCycles(setId: Id): Promise<Cycle[]> {
      return db.cycles.where('[setId+number]').between([setId, Dexie.minKey], [setId, Dexie.maxKey]).toArray()
    },

    async startCycle(setId: Id): Promise<Cycle> {
      return db.transaction('rw', db.cycles, async () => {
        const count = await db.cycles.where('setId').equals(setId).count()
        const cycle: Cycle = {
          id: newId(),
          setId,
          number: count + 1,
          startedAt: now(),
          completedAt: null,
          attempts: [],
        }
        await db.cycles.add(cycle)
        return cycle
      })
    },

    /** Records (or replaces) the result for one puzzle in a cycle. */
    async recordAttempt(cycleId: Id, attempt: Omit<Attempt, 'attemptedAt'>): Promise<Cycle> {
      return db.transaction('rw', db.cycles, db.puzzles, async () => {
        const cycle = await db.cycles.get(cycleId)
        if (!cycle) throw new Error('Cycle not found.')
        const attempts = cycle.attempts.filter((a) => a.puzzleId !== attempt.puzzleId)
        attempts.push({ ...attempt, attemptedAt: now() })
        const total = await db.puzzles.where('setId').equals(cycle.setId).count()
        const completedAt = attempts.length >= total ? now() : null
        const updated = { ...cycle, attempts, completedAt }
        await db.cycles.put(updated)
        return updated
      })
    },
  }
}

export type Repository = ReturnType<typeof createRepository>
