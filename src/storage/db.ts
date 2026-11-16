import Dexie, { type EntityTable } from 'dexie'
import type { Cycle, Puzzle, PuzzleSet } from '../model/types'

/** Browser database (IndexedDB). Everything stays on this device. */
export class WoodpeckerDB extends Dexie {
  sets!: EntityTable<PuzzleSet, 'id'>
  puzzles!: EntityTable<Puzzle, 'id'>
  cycles!: EntityTable<Cycle, 'id'>

  constructor(name = 'woodpecker') {
    super(name)
    this.version(1).stores({
      sets: 'id, updatedAt',
      puzzles: 'id, setId, [setId+order]',
      cycles: 'id, setId, [setId+number]',
    })
  }
}

export const db = new WoodpeckerDB()
