-- Run this in your Supabase SQL editor

-- User topics table
create table if not exists user_topics (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  topic text not null,
  created_at timestamptz default now(),
  unique(user_id, topic)
);

-- News cache table
create table if not exists news_cache (
  id uuid default gen_random_uuid() primary key,
  topic text not null,
  title text not null,
  summary text not null,
  sources jsonb not null default '[]',
  image_url text,
  published_at timestamptz default now(),
  cached_at timestamptz default now()
);

-- Index for fast topic lookups
create index if not exists news_cache_topic_idx on news_cache(topic);
create index if not exists news_cache_cached_at_idx on news_cache(cached_at desc);
create index if not exists user_topics_user_id_idx on user_topics(user_id);

-- RLS: anyone with service role can read/write
alter table user_topics enable row level security;
alter table news_cache enable row level security;

-- Allow service role full access (API routes use service role key)
create policy "service role all" on user_topics for all using (true);
create policy "service role all" on news_cache for all using (true);
