import type { Cycle, Puzzle, PuzzleSet } from '../model/types'
import type { WoodpeckerDB } from './db'

/**
 * A full copy of everything the app keeps on this device: sets, puzzles
 * (with notes and ticks) and cycles (with every attempt and session).
 * Used to move training between devices, e.g. computer and phone.
 */
export interface Backup {
  app: 'woodpecker'
  version: 1
  exportedAt: number
  sets: PuzzleSet[]
  puzzles: Puzzle[]
  cycles: Cycle[]
}

export interface BackupCounts {
  sets: number
  puzzles: number
  cycles: number
  attempts: number
}

export function countBackup(b: Pick<Backup, 'sets' | 'puzzles' | 'cycles'>): BackupCounts {
  return {
    sets: b.sets.length,
    puzzles: b.puzzles.length,
    cycles: b.cycles.length,
    attempts: b.cycles.reduce((n, c) => n + c.attempts.length, 0),
  }
}

export async function exportBackup(db: WoodpeckerDB, now: () => number = Date.now): Promise<Backup> {
  return db.transaction('r', db.sets, db.puzzles, db.cycles, async () => ({
    app: 'woodpecker' as const,
    version: 1 as const,
    exportedAt: now(),
    sets: await db.sets.toArray(),
    puzzles: await db.puzzles.toArray(),
    cycles: await db.cycles.toArray(),
  }))
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

/** Reads and checks a backup file's text. Throws a readable error if it isn't one. */
export function parseBackup(text: string): Backup {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('This file is not a Woodpecker backup (it is not JSON).')
  }
  if (!isObj(data) || data.app !== 'woodpecker') throw new Error('This file is not a Woodpecker backup.')
  if (data.version !== 1) throw new Error('This backup was made by a newer version of the app. Reload and try again.')
  const { sets, puzzles, cycles } = data
  if (!Array.isArray(sets) || !Array.isArray(puzzles) || !Array.isArray(cycles)) {
    throw new Error('This backup is incomplete.')
  }
  const bad =
    sets.some((s) => !isObj(s) || typeof s.id !== 'string' || typeof s.name !== 'string') ||
    puzzles.some((p) => !isObj(p) || typeof p.id !== 'string' || typeof p.setId !== 'string' || typeof p.fen !== 'string' || !Array.isArray(p.solution)) ||
    cycles.some((c) => !isObj(c) || typeof c.id !== 'string' || typeof c.setId !== 'string' || !Array.isArray(c.attempts))
  if (bad) throw new Error('This backup is damaged.')
  return data as unknown as Backup
}

/** Replaces everything on this device with the backup, in one transaction. */
export async function restoreBackup(db: WoodpeckerDB, backup: Backup): Promise<void> {
  await db.transaction('rw', db.sets, db.puzzles, db.cycles, async () => {
    await Promise.all([db.sets.clear(), db.puzzles.clear(), db.cycles.clear()])
    await db.sets.bulkAdd(backup.sets)
    await db.puzzles.bulkAdd(backup.puzzles)
    await db.cycles.bulkAdd(backup.cycles)
  })
}
