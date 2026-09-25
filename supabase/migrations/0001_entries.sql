-- Tend journal entries. Paste into the Supabase SQL editor once.
--
-- Every entry belongs to one user, and Row Level Security lets each user read
-- and write only their own rows. The database also enforces the journal's
-- rules, so a bug in the app can never store a tagged Bad or a pulled Good.

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  -- Filled from the session, so the app never sends a user id.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('good', 'bad')),
  tag text check (tag in ('people', 'body', 'work', 'nature', 'smallJoys')),
  text text not null check (char_length(text) between 1 and 280),
  -- The plant's place in its day's row. Stored, so deleting an entry never
  -- moves another plant.
  slot int not null check (slot >= 0),
  pulled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint entries_tag_only_on_goods check ((kind = 'good') = (tag is not null)),
  constraint entries_pulled_only_bads check (pulled_at is null or kind = 'bad'),
  constraint entries_slot_unique unique (user_id, date, slot)
);

create index entries_user_date_idx on public.entries (user_id, date);

alter table public.entries enable row level security;

create policy entries_own on public.entries
  as permissive for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Logged-out visitors see the demo garden, which lives in code. They never
-- touch this table.
revoke all on public.entries from anon;
