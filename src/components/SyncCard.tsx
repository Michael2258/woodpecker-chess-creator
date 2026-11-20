import { useState, type FormEvent } from 'react'
import { sendSignInLink, signOut, syncLabel, syncNow, useSyncState } from '../sync/controller'

/** Sign in once per device; after that sets and progress sync on their own. */
export function SyncCard() {
  const s = useSyncState()
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!s.configured) return null

  async function onSend(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendSignInLink(email)
      setSentTo(email.trim())
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card stack sync-card" id="sync">
      <h2>Sync between devices</h2>
      {s.loading ? (
        <p className="muted small">Checking sign-in…</p>
      ) : s.email ? (
        <>
          <p className="small">
            Signed in as <strong>{s.email}</strong>. Your sets, notes and progress sync automatically with every
            device signed in to this account. You can keep training offline; changes go up when you're back online.
          </p>
          <p className={s.error ? 'error small' : 'muted small'}>
            {syncLabel(s)}
            {s.error && `: ${s.error}`}
          </p>
          <div className="row wrap">
            <button type="button" onClick={() => void syncNow()} disabled={s.syncing}>
              Sync now
            </button>
            <button type="button" className="secondary" onClick={() => void signOut()}>
              Sign out
            </button>
          </div>
        </>
      ) : sentTo ? (
        <>
          <p className="small">
            We sent a sign-in link to <strong>{sentTo}</strong>. Open it on this device to start syncing.
          </p>
          <div className="row wrap">
            <button type="button" className="secondary" onClick={() => setSentTo(null)}>
              Use a different email
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="muted small">
            Sign in with the same email on your phone and computer, and everything on this device is uploaded and
            kept in sync. No password needed: we email you a link.
          </p>
          <form className="row wrap" onSubmit={onSend}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for sync"
              autoComplete="email"
            />
            <button type="submit" disabled={busy}>
              {busy ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
        </>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
