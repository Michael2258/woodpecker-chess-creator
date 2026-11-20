import { useState, type FormEvent } from 'react'
import { createAccount, signInWithPassword, signOut, syncLabel, syncNow, useSyncState } from '../sync/controller'

/** Sign in once per device; after that sets and progress sync on their own. */
export function SyncCard() {
  const s = useSyncState()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!s.configured) return null

  async function run(action: 'signIn' | 'create') {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (action === 'signIn') {
        await signInWithPassword(email, password)
      } else if (!(await createAccount(email, password))) {
        setNotice('Account created, but Supabase wants the email confirmed first. Open the link it sent, then sign in.')
      }
      setPassword('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void run('signIn')
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
      ) : (
        <>
          <p className="muted small">
            Sign in with the same email and password on your phone and computer, and everything on this device is
            uploaded and kept in sync. First time? Fill in both fields and choose Create account.
          </p>
          <form className="stack sync-form" onSubmit={onSubmit}>
            <input
              type="email"
              required
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-label="Email for sync"
              autoComplete="username"
            />
            <input
              type="password"
              required
              minLength={6}
              placeholder="Password (at least 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-label="Password for sync"
              autoComplete="current-password"
            />
            <div className="row wrap">
              <button type="submit" disabled={busy}>
                {busy ? 'Please wait…' : 'Sign in'}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={(e) => {
                  const form = e.currentTarget.form
                  if (form?.reportValidity()) void run('create')
                }}
              >
                Create account
              </button>
            </div>
          </form>
        </>
      )}
      {notice && <p className="info">{notice}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  )
}
