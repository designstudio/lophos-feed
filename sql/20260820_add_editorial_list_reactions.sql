create table if not exists public.editorial_list_reactions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  list_id uuid not null references public.editorial_lists(id) on delete cascade,
  topic text not null,
  matched_topics text[] not null default '{}',
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, list_id)
);

create index if not exists editorial_list_reactions_user_id_idx
  on public.editorial_list_reactions (user_id);

create index if not exists editorial_list_reactions_list_id_idx
  on public.editorial_list_reactions (list_id);

alter table public.editorial_list_reactions enable row level security;

revoke all on table public.editorial_list_reactions from anon, authenticated;
grant all on table public.editorial_list_reactions to service_role;

drop policy if exists "service role all" on public.editorial_list_reactions;
create policy "service role all"
  on public.editorial_list_reactions
  for all
  to service_role
  using (true)
  with check (true);

notify pgrst, 'reload schema';
