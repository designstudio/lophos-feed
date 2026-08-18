-- Compact history used to prevent old RSS URLs from being ingested again
-- after their processed raw_items rows leave the 60-day hot window.
create table if not exists public.raw_item_history (
  url                  text primary key,
  dedup_hash           text,
  original_raw_item_id uuid,
  original_fetched_at  timestamptz,
  archived_at          timestamptz not null default now()
);

create index if not exists raw_item_history_dedup_hash_idx
  on public.raw_item_history (dedup_hash)
  where dedup_hash is not null;

create index if not exists raw_items_processed_fetched_at_idx
  on public.raw_items (fetched_at)
  where processed is true;

alter table public.raw_item_history enable row level security;

drop policy if exists "service role all" on public.raw_item_history;
create policy "service role all"
  on public.raw_item_history
  for all
  to service_role
  using (true)
  with check (true);

-- Applies one bounded retention batch in a single transaction:
--   * compact processed raw items between 15 and 60 days;
--   * archive and delete processed raw items older than 60 days;
--   * delete inactive preflight/cluster runs older than 14 days.
-- Raw items referenced by active runs are preserved regardless of age.
drop function if exists public.archive_and_delete_processed_raw_items(timestamptz, integer);

create or replace function public.apply_news_retention_batch(
  p_compact_cutoff timestamptz,
  p_delete_cutoff timestamptz,
  p_run_cutoff timestamptz,
  p_batch_size integer default 50
)
returns table (
  compacted_count integer,
  archived_count integer,
  deleted_count integer,
  preflight_runs_deleted integer,
  cluster_runs_deleted integer
)
language sql
security definer
set search_path = public
as $$
  with protected_cluster_runs as materialized (
    select ranked.id
    from (
      select
        run.id,
        row_number() over (partition by run.status order by run.created_at desc) as position
      from public.news_cluster_runs as run
      where run.status in ('ready', 'manual_ready')
    ) as ranked
    where ranked.position = 1

    union

    select run.id
    from public.news_cluster_runs as run
    where run.status = 'processing'
  ),
  active_run_payloads as materialized (
    select run.payload
    from public.news_cluster_runs as run
    inner join protected_cluster_runs as protected on protected.id = run.id

    union all

    select run.payload
    from public.news_preflight_runs as run
    where run.created_at >= p_run_cutoff
  ),
  active_raw_ids as materialized (
    select trim(both '"' from raw_id::text) as raw_id
    from active_run_payloads as run
    cross join lateral jsonb_path_query(run.payload, '$.**.id') as raw_id

    union

    select trim(both '"' from raw_id::text) as raw_id
    from active_run_payloads as run
    cross join lateral jsonb_path_query(run.payload, '$.topics[*].clusters[*][*]') as raw_id

    union

    select trim(both '"' from raw_id::text) as raw_id
    from active_run_payloads as run
    cross join lateral jsonb_path_query(run.payload, '$.**.currentId') as raw_id

    union

    select trim(both '"' from raw_id::text) as raw_id
    from active_run_payloads as run
    cross join lateral jsonb_path_query(run.payload, '$.**.historyId') as raw_id

    union

    select trim(both '"' from raw_id::text) as raw_id
    from active_run_payloads as run
    cross join lateral jsonb_path_query(run.payload, '$.semanticDuplicateRawIds[*]') as raw_id
  ),
  compaction_candidates as (
    select raw.id
    from public.raw_items as raw
    where raw.processed is true
      and raw.fetched_at < p_compact_cutoff
      and raw.fetched_at >= p_delete_cutoff
      and (raw.content is not null or raw.summary is not null)
      and not exists (
        select 1 from active_raw_ids as active where active.raw_id = raw.id::text
      )
    order by raw.fetched_at asc
    limit least(greatest(p_batch_size, 1), 5000)
    for update skip locked
  ),
  compacted as (
    update public.raw_items as raw
    set content = null,
        summary = null
    from compaction_candidates
    where raw.id = compaction_candidates.id
    returning raw.id
  ),
  deletion_candidates as (
    select id, url, dedup_hash, fetched_at
    from public.raw_items as raw
    where raw.processed is true
      and raw.fetched_at < p_delete_cutoff
      and not exists (
        select 1 from active_raw_ids as active where active.raw_id = raw.id::text
      )
    order by raw.fetched_at asc
    limit least(greatest(p_batch_size, 1), 5000)
    for update skip locked
  ),
  archived as (
    insert into public.raw_item_history (
      url,
      dedup_hash,
      original_raw_item_id,
      original_fetched_at
    )
    select url, dedup_hash, id, fetched_at
    from deletion_candidates
    on conflict (url) do update set
      dedup_hash = coalesce(excluded.dedup_hash, public.raw_item_history.dedup_hash),
      original_raw_item_id = excluded.original_raw_item_id,
      original_fetched_at = excluded.original_fetched_at
    returning url
  ),
  deleted as (
    delete from public.raw_items as raw
    using deletion_candidates
    where raw.id = deletion_candidates.id
      and exists (
        select 1
        from archived
        where archived.url = deletion_candidates.url
      )
    returning raw.id
  ),
  deleted_preflight_runs as (
    delete from public.news_preflight_runs as run
    where run.created_at < p_run_cutoff
      and run.id in (
        select candidate.id
        from public.news_preflight_runs as candidate
        where candidate.created_at < p_run_cutoff
        order by candidate.created_at asc
        limit least(greatest(p_batch_size, 1), 5000)
      )
    returning run.id
  ),
  deleted_cluster_runs as (
    delete from public.news_cluster_runs as run
    where run.created_at < p_run_cutoff
      and not exists (
        select 1
        from protected_cluster_runs as protected
        where protected.id = run.id
      )
      and run.id in (
        select candidate.id
        from public.news_cluster_runs as candidate
        where candidate.created_at < p_run_cutoff
          and not exists (
            select 1
            from protected_cluster_runs as protected
            where protected.id = candidate.id
          )
        order by candidate.created_at asc
        limit least(greatest(p_batch_size, 1), 5000)
      )
    returning run.id
  )
  select
    (select count(*)::integer from compacted),
    (select count(*)::integer from archived),
    (select count(*)::integer from deleted),
    (select count(*)::integer from deleted_preflight_runs),
    (select count(*)::integer from deleted_cluster_runs);
$$;

revoke all on function public.apply_news_retention_batch(timestamptz, timestamptz, timestamptz, integer) from public;
revoke all on function public.apply_news_retention_batch(timestamptz, timestamptz, timestamptz, integer) from anon;
revoke all on function public.apply_news_retention_batch(timestamptz, timestamptz, timestamptz, integer) from authenticated;
grant execute on function public.apply_news_retention_batch(timestamptz, timestamptz, timestamptz, integer) to service_role;
