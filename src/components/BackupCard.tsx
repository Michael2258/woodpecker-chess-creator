import { useRef, useState } from 'react'
import { db } from '../storage/db'
import { countBackup, exportBackup, parseBackup, restoreBackup, type Backup, type BackupCounts } from '../storage/backup'

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`
const describe = (c: BackupCounts) =>
  `${plural(c.sets, 'set')}, ${plural(c.puzzles, 'puzzle')}, ${plural(c.cycles, 'cycle')}, ${plural(c.attempts, 'solved attempt')}`

function fileName(at: number) {
  const d = new Date(at)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `woodpecker-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`
}

/**
 * Saves everything on this device to one file, and restores such a file.
 * This is how training moves between devices (e.g. computer and phone),
 * since all data lives in this browser only.
 */
export function BackupCard() {
  const input = useRef<HTMLInputElement>(null)
  const [pending, setPending] = useState<{ fileName: string; backup: Backup } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onExport() {
    setError(null)
    setInfo(null)
    try {
      const backup = await exportBackup(db)
      const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName(backup.exportedAt)
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setInfo(`Saved ${describe(countBackup(backup))}.`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function onPick(f: File | undefined) {
    if (input.current) input.current.value = ''
    if (!f) return
    setError(null)
    setInfo(null)
    try {
      setPending({ fileName: f.name, backup: parseBackup(await f.text()) })
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function onRestore() {
    if (!pending) return
    setBusy(true)
    setError(null)
    try {
      await restoreBackup(db, pending.backup)
      // The solve page's remembered view may point at puzzles that no longer exist.
      try {
        sessionStorage.clear()
      } catch {
        /* ignore */
      }
      setInfo(`Restored ${describe(countBackup(pending.backup))}.`)
      setPending(null)
    } catch (err) {
      setError(`Restore failed, nothing was changed: ${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack backup-card">
      <div>
        <h2>Backup and other devices</h2>
        <p className="muted small">
          Your sets and progress are saved in this browser only. To continue on another device (for example your
          phone), save a backup here, then open the app there and restore it. Restoring replaces everything on that
          device, so always restore from the device you trained on most recently. If you use sync, a restore also replaces your synced data.
        </p>
      </div>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="sr"
        tabIndex={-1}
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      {pending ? (
        <div className="stack">
          <p>
            <strong>{pending.fileName}</strong> was saved{' '}
            {new Date(pending.backup.exportedAt).toLocaleString()} and holds {describe(countBackup(pending.backup))}.
          </p>
          <p className="error">This replaces all sets and progress currently on this device.</p>
          <div className="row wrap">
            <button type="button" onClick={onRestore} disabled={busy}>
              {busy ? 'Restoring…' : 'Replace and restore'}
            </button>
            <button type="button" className="secondary" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="row wrap">
          <button type="button" onClick={onExport}>
            Save backup
          </button>
          <button type="button" className="secondary" onClick={() => input.current?.click()}>
            Restore from backup…
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {info && <p className="info">{info}</p>}
    </section>
  )
}
