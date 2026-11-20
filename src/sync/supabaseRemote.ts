import type { SupabaseClient } from '@supabase/supabase-js'
import type { OutgoingRow, Remote, RemoteRow } from './engine'

const TABLE = 'woodpecker_records'
const PAGE = 1000
const BATCH = 500

interface Row {
  kind: RemoteRow['kind']
  id: string
  data: RemoteRow['data']
  deleted: boolean
  server_updated_at: string
}

export function supabaseRemote(client: SupabaseClient, userId: string): Remote {
  return {
    async pull(since) {
      const out: RemoteRow[] = []
      for (let from = 0; ; from += PAGE) {
        let q = client.from(TABLE).select('kind,id,data,deleted,server_updated_at')
        if (since) q = q.gte('server_updated_at', since)
        const { data, error } = await q
          .order('server_updated_at', { ascending: true })
          .order('kind')
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw new Error(error.message)
        const rows = (data ?? []) as Row[]
        for (const r of rows) {
          out.push({ kind: r.kind, id: r.id, data: r.data, deleted: r.deleted, serverUpdatedAt: r.server_updated_at })
        }
        if (rows.length < PAGE) return out
      }
    },
    async push(rows: OutgoingRow[]) {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map((r) => ({ user_id: userId, ...r }))
        const { error } = await client.from(TABLE).upsert(batch, { onConflict: 'user_id,kind,id' })
        if (error) throw new Error(error.message)
      }
    },
  }
}
