-- RSS feeds table used by the ingestion pipeline.
-- Safe to run multiple times.

create table if not exists rss_feeds (
  id            uuid default gen_random_uuid() primary key,
  url           text not null unique,
  name          text not null,
  topics        text[] not null default '{}',
  language      text not null default 'pt',
  active        boolean not null default true,
  last_etag     text,
  last_modified text,
  last_error    text,
  last_error_at timestamptz,
  last_fetched  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists rss_feeds_active_idx on rss_feeds(active);
create index if not exists rss_feeds_language_idx on rss_feeds(language);

alter table rss_feeds enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rss_feeds'
      and policyname = 'service role all'
  ) then
    create policy "service role all" on rss_feeds for all using (true);
  end if;
end $$;

