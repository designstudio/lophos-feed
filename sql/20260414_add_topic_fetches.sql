-- Add topic_fetches table used by debug stats and refresh-all routes
-- Safe to run multiple times.

create table if not exists topic_fetches (
  topic        text primary key,
  last_fetched  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table topic_fetches enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'topic_fetches'
      and policyname = 'service role all'
  ) then
    create policy "service role all" on topic_fetches for all using (true);
  end if;
end $$;

