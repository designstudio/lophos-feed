-- Stores each execution of the news preflight so we can compare runs over time.
create table if not exists news_preflight_runs (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz not null default now(),
  window_hours integer not null,
  batch_size integer not null,
  total_fetched integer not null default 0,
  total_accepted integer not null default 0,
  total_rejected integer not null default 0,
  total_duplicates integer not null default 0,
  total_semantic_duplicates integer not null default 0,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists news_preflight_runs_created_at_idx on news_preflight_runs(created_at desc);
create index if not exists news_preflight_runs_total_fetched_idx on news_preflight_runs(total_fetched desc);

alter table news_preflight_runs enable row level security;
create policy "service role all" on news_preflight_runs for all using (true);
