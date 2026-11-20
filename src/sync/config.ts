/**
 * Supabase project used for cloud sync. Both values are public by design
 * (the anon key only allows what the database's row level security allows).
 * Set them here or with VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.
 */
const PROJECT_URL = 'https://entloipemzqrevxyzsgv.supabase.co'
const ANON_KEY = 'sb_publishable_wjsVgj01Ej2qWLSZU0WprQ_XybSlNtL'

export const supabaseConfig = {
  url: (import.meta.env.VITE_SUPABASE_URL as string | undefined) || PROJECT_URL,
  anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ANON_KEY,
}

export const syncConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey)
