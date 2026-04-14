create table if not exists public.news_cluster_runs (
  id uuid primary key default gen_random_uuid(),
  preflight_run_id uuid not null references public.news_preflight_runs(id) on delete cascade,
  window_hours integer not null,
  history_hours integer not null,
  batch_size integer not null,
  total_topics integer not null default 0,
  total_accepted integer not null default 0,
  total_clusters integer not null default 0,
  total_rejected integer not null default 0,
  payload jsonb not null,
  status text not null default 'ready',
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists news_cluster_runs_created_at_idx
  on public.news_cluster_runs (created_at desc);

create index if not exists news_cluster_runs_status_idx
  on public.news_cluster_runs (status);

create index if not exists news_cluster_runs_preflight_run_id_idx
  on public.news_cluster_runs (preflight_run_id);
