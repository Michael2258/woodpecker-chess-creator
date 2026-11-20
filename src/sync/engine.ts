import type { Attempt, Cycle, Puzzle, PuzzleSet } from '../model/types'
import type { WoodpeckerDB } from '../storage/db'

export type Kind = 'set' | 'puzzle' | 'cycle'
type AnyRecord = PuzzleSet | Puzzle | Cycle

/** One record as stored in the cloud. */
export interface RemoteRow {
  kind: Kind
  id: string
  data: AnyRecord | null
  deleted: boolean
  /** Server time of the last write, ISO 8601. Used as the pull cursor. */
  serverUpdatedAt: string
}

export type OutgoingRow = Omit<RemoteRow, 'serverUpdatedAt'>

/** The cloud side of sync. Supabase in the app, an in-memory fake in tests. */
export interface Remote {
  /** Rows written at or after `since` (all rows when null), oldest first. */
  pull(since: string | null): Promise<RemoteRow[]>
  push(rows: OutgoingRow[]): Promise<void>
}

export interface SyncResult {
  pulled: number
  pushed: number
}

const KINDS: Kind[] = ['set', 'puzzle', 'cycle']
const keyOf = (kind: Kind, id: string) => `${kind}:${id}`
const tableOf = (db: WoodpeckerDB, kind: Kind) =>
  (kind === 'set' ? db.sets : kind === 'puzzle' ? db.puzzles : db.cycles) as unknown as import('dexie').Table<
    AnyRecord,
    string
  >

/** JSON with sorted keys, so the same record always gives the same text. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}
export const fingerprint = (r: AnyRecord) => stable(r)

/** Both devices trained on the same cycle: keep each puzzle's latest attempt. */
export function mergeCycles(a: Cycle, b: Cycle): Cycle {
  const byPuzzle = new Map<string, Attempt>()
  for (const at of [...a.attempts, ...b.attempts]) {
    const cur = byPuzzle.get(at.puzzleId)
    if (!cur || at.attemptedAt > cur.attemptedAt) byPuzzle.set(at.puzzleId, at)
  }
  const attempts = [...byPuzzle.values()].sort((x, y) => x.attemptedAt - y.attemptedAt)
  const done = [a.completedAt, b.completedAt].filter((t): t is number => t !== null)
  return {
    ...a,
    startedAt: Math.min(a.startedAt, b.startedAt),
    completedAt: done.length ? Math.max(...done) : null,
    attempts,
  }
}

/** Decides what to keep when a record changed both here and in the cloud. */
function resolve(kind: Kind, local: AnyRecord, remote: AnyRecord): AnyRecord {
  if (kind === 'cycle') return mergeCycles(local as Cycle, remote as Cycle)
  const l = local as PuzzleSet | Puzzle
  const r = remote as PuzzleSet | Puzzle
  return r.updatedAt > l.updatedAt ? r : l
}

/** Pulls cloud changes into this device, then uploads this device's changes. */
export async function syncOnce(db: WoodpeckerDB, remote: Remote, userId: string): Promise<SyncResult> {
  // A different account on this device starts from scratch: everything here is new to it.
  const owner = await db.syncMeta.get('userId')
  if (owner?.value !== userId) {
    await db.transaction('rw', db.syncShadow, db.syncMeta, async () => {
      await db.syncShadow.clear()
      await db.syncMeta.clear()
      await db.syncMeta.put({ key: 'userId', value: userId })
    })
  }

  // ---- Pull ----
  const cursor = (await db.syncMeta.get('cursor'))?.value ?? null
  const rows = await remote.pull(cursor)
  let pulled = 0
  if (rows.length) {
    await db.transaction('rw', [db.sets, db.puzzles, db.cycles, db.syncShadow, db.syncMeta], async () => {
      for (const row of rows) {
        const table = tableOf(db, row.kind)
        const key = keyOf(row.kind, row.id)
        const local = await table.get(row.id)
        const shadow = (await db.syncShadow.get(key))?.hash
        const localHash = local ? fingerprint(local) : undefined
        const remoteHash = row.deleted || !row.data ? undefined : fingerprint(row.data)
        if (localHash === remoteHash) {
          // Already the same here.
          if (remoteHash) await db.syncShadow.put({ key, hash: remoteHash })
          else await db.syncShadow.delete(key)
          continue
        }
        // The cloud has nothing new for this record (e.g. our own upload coming back):
        // whatever changed here is uploaded below.
        if (remoteHash === shadow) continue
        const dirty = localHash !== shadow
        pulled++
        if (!dirty || !local) {
          // No local changes, or deleted here but changed there: take the cloud version.
          // (An edit made on one device wins over a delete made on the other.)
          if (remoteHash) {
            await table.put(row.data!)
            await db.syncShadow.put({ key, hash: remoteHash })
          } else {
            await table.delete(row.id)
            await db.syncShadow.delete(key)
          }
          continue
        }
        // Changed on both sides.
        if (!row.data || row.deleted) {
          // Deleted there, edited here: keep the edit; it is uploaded below.
          await db.syncShadow.delete(key)
          continue
        }
        const merged = resolve(row.kind, local, row.data)
        await table.put(merged)
        // Remember the cloud version, so a merged result that differs gets uploaded.
        await db.syncShadow.put({ key, hash: remoteHash! })
      }
      const last = rows[rows.length - 1].serverUpdatedAt
      await db.syncMeta.put({ key: 'cursor', value: last })
    })
  }

  // ---- Push ----
  const shadows = new Map((await db.syncShadow.toArray()).map((s) => [s.key, s.hash]))
  const out: OutgoingRow[] = []
  const newHashes: { key: string; hash: string }[] = []
  for (const kind of KINDS) {
    for (const rec of await tableOf(db, kind).toArray()) {
      const key = keyOf(kind, rec.id)
      const hash = fingerprint(rec)
      if (shadows.get(key) !== hash) {
        out.push({ kind, id: rec.id, data: rec, deleted: false })
        newHashes.push({ key, hash })
      }
      shadows.delete(key)
    }
  }
  // Whatever is left in the shadow was deleted on this device.
  const gone = [...shadows.keys()]
  for (const key of gone) {
    const i = key.indexOf(':')
    out.push({ kind: key.slice(0, i) as Kind, id: key.slice(i + 1), data: null, deleted: true })
  }
  if (out.length) {
    await remote.push(out)
    await db.transaction('rw', db.syncShadow, async () => {
      await db.syncShadow.bulkPut(newHashes)
      await db.syncShadow.bulkDelete(gone)
    })
  }
  return { pulled, pushed: out.length }
}
