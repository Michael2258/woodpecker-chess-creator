import Dexie, { type EntityTable } from 'dexie'
import type { Cycle, Puzzle, PuzzleSet } from '../model/types'

/**
 * What this device last agreed with the cloud for one record: a fingerprint
 * of the record as it was synced. A record whose fingerprint differs has
 * local changes still to upload; one missing locally was deleted here.
 */
export interface SyncShadow {
  /** `${kind}:${id}` */
  key: string
  hash: string
}

export interface SyncMeta {
  key: string
  value: string
}

/** Browser database (IndexedDB). Works offline; cloud sync is optional. */
export class WoodpeckerDB extends Dexie {
  sets!: EntityTable<PuzzleSet, 'id'>
  puzzles!: EntityTable<Puzzle, 'id'>
  cycles!: EntityTable<Cycle, 'id'>
  syncShadow!: EntityTable<SyncShadow, 'key'>
  syncMeta!: EntityTable<SyncMeta, 'key'>

  constructor(name = 'woodpecker') {
    super(name)
    this.version(1).stores({
      sets: 'id, updatedAt',
      puzzles: 'id, setId, [setId+order]',
      cycles: 'id, setId, [setId+number]',
    })
    this.version(2).stores({
      syncShadow: 'key',
      syncMeta: 'key',
    })
  }
}

export const db = new WoodpeckerDB()
