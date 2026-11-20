import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { db } from '../storage/db'
import { supabaseConfig, syncConfigured } from './config'
import { syncOnce } from './engine'
import { supabaseRemote } from './supabaseRemote'

export interface SyncState {
  configured: boolean
  /** Still finding out whether someone is signed in. */
  loading: boolean
  email: string | null
  syncing: boolean
  lastSyncedAt: number | null
  error: string | null
  online: boolean
}

let state: SyncState = {
  configured: syncConfigured,
  loading: syncConfigured,
  email: null,
  syncing: false,
  lastSyncedAt: null,
  error: null,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
}
const listeners = new Set<() => void>()
function set(changes: Partial<SyncState>) {
  state = { ...state, ...changes }
  listeners.forEach((l) => l())
}

let client: SupabaseClient | null = null
let session: Session | null = null
let running: Promise<void> | null = null
let again = false
let applying = false
let timer: ReturnType<typeof setTimeout> | undefined

/** Runs one sync now, or right after the one in progress. */
export function syncNow(): Promise<void> {
  if (!client || !session) return Promise.resolve()
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    set({ syncing: true })
    try {
      do {
        again = false
        applying = true
        try {
          await syncOnce(db, supabaseRemote(client!, session!.user.id), session!.user.id)
        } finally {
          applying = false
        }
      } while (again)
      set({ lastSyncedAt: Date.now(), error: null })
    } catch (err) {
      set({ error: navigator.onLine ? (err as Error).message : null })
    } finally {
      running = null
      set({ syncing: false })
    }
  })()
  return running
}

/** Syncs shortly after the last local change, so a burst of edits goes up together. */
function scheduleSync(delay = 1500) {
  if (applying || !session) return
  clearTimeout(timer)
  timer = setTimeout(() => void syncNow(), delay)
}

export async function signInWithPassword(email: string, password: string) {
  if (!client) throw new Error('Cloud sync is not set up.')
  const { error } = await client.auth.signInWithPassword({ email: email.trim(), password })
  if (error) {
    if (/invalid login credentials/i.test(error.message)) {
      throw new Error('Wrong email or password. If this is your first time, choose "Create account" instead.')
    }
    throw new Error(error.message)
  }
}

/** Returns false when the account needs its email confirmed before it can sign in. */
export async function createAccount(email: string, password: string): Promise<boolean> {
  if (!client) throw new Error('Cloud sync is not set up.')
  const { data, error } = await client.auth.signUp({ email: email.trim(), password })
  if (error) throw new Error(error.message)
  return Boolean(data.session)
}

export async function signOut() {
  await client?.auth.signOut()
}

let started = false
/** Connects to Supabase and keeps this device in sync while the app is open. */
export function startSync() {
  if (started || !syncConfigured) return
  started = true
  client = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'implicit' },
  })
  client.auth.onAuthStateChange((event, s) => {
    const wasSignedIn = Boolean(session)
    session = s
    set({ loading: false, email: s?.user.email ?? null, error: null })
    if (s && (!wasSignedIn || event === 'SIGNED_IN')) setTimeout(() => void syncNow(), 0)
  })

  for (const table of [db.sets, db.puzzles, db.cycles]) {
    table.hook('creating', () => scheduleSync())
    table.hook('updating', () => scheduleSync())
    table.hook('deleting', () => scheduleSync())
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
  window.addEventListener('online', () => {
    set({ online: true })
    void syncNow()
  })
  window.addEventListener('offline', () => set({ online: false }))
  setInterval(() => {
    if (document.visibilityState === 'visible') void syncNow()
  }, 60_000)
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

export function syncLabel(s: SyncState): string {
  if (!s.email) return 'Not syncing'
  if (!s.online) return 'Offline, will sync when back online'
  if (s.syncing) return 'Syncing…'
  if (s.error) return 'Sync failed'
  if (s.lastSyncedAt) return `Synced ${new Date(s.lastSyncedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
  return 'Signed in'
}
