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

-- User reactions (like/dislike)
create table if not exists user_reactions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  article_id uuid not null,
  topic text not null,
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz default now(),
  unique(user_id, article_id)
);

-- Indexes
create index if not exists news_cache_topic_idx on news_cache(topic);
create index if not exists news_cache_cached_at_idx on news_cache(cached_at desc);
create index if not exists user_topics_user_id_idx on user_topics(user_id);
create index if not exists user_reactions_user_id_idx on user_reactions(user_id);

-- RLS
alter table user_topics enable row level security;
alter table news_cache enable row level security;
alter table user_reactions enable row level security;

create policy "service role all" on user_topics for all using (true);
create policy "service role all" on news_cache for all using (true);
create policy "service role all" on user_reactions for all using (true);

-- Permanent articles table — never cleared, preserves articles the user has opened
create table if not exists articles (
  id           uuid primary key,
  topic        text not null,
  title        text not null,
  summary      text,
  sources      jsonb,
  image_url    text,
  published_at timestamptz,
  cached_at    timestamptz,
  created_at   timestamptz default now()
);

create index if not exists articles_topic_idx on articles(topic);
alter table articles enable row level security;
create policy "service role all" on articles for all using (true);

-- Add sections and conclusion columns to news_cache and articles
alter table news_cache add column if not exists sections jsonb default '[]';
alter table news_cache add column if not exists conclusion text;
alter table articles add column if not exists sections jsonb default '[]';
alter table articles add column if not exists conclusion text;

-- Tracks last fetch time per topic — separate from articles themselves
create table if not exists topic_fetches (
  topic        text primary key,
  last_fetched timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
