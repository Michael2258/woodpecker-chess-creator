-- Cloud storage for Woodpecker sync. Run once in the Supabase SQL editor.
-- Every set, puzzle and cycle is one row, owned by the signed-in user.

create table if not exists public.woodpecker_records (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('set', 'puzzle', 'cycle')),
  id text not null,
  data jsonb,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, kind, id)
);

create index if not exists woodpecker_records_pull
  on public.woodpecker_records (user_id, server_updated_at);

-- The server stamps every write, so devices can ask "what changed since X".
create or replace function public.woodpecker_touch() returns trigger
language plpgsql as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

drop trigger if exists woodpecker_touch on public.woodpecker_records;
create trigger woodpecker_touch before insert or update on public.woodpecker_records
  for each row execute function public.woodpecker_touch();

-- Each user can only see and change their own rows.
alter table public.woodpecker_records enable row level security;

drop policy if exists "own records" on public.woodpecker_records;
create policy "own records" on public.woodpecker_records
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
