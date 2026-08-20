-- Run this in your Supabase SQL editor

-- User topics table
create table if not exists user_topics (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  topic text not null,
  created_at timestamptz default now(),
  unique(user_id, topic)
);

-- User reactions (like/dislike)
create table if not exists user_reactions (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  article_id uuid not null,
  topic text not null,
  matched_topics text[] not null default '{}',
  reaction text not null check (reaction in ('like', 'dislike')),
  created_at timestamptz default now(),
  unique(user_id, article_id)
);

-- Learned negative topics inferred from disliked articles
create table if not exists user_negative_topics (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  topic text not null,
  dislike_count integer not null default 0,
  first_disliked_at timestamptz default now(),
  last_disliked_at timestamptz default now(),
  unique(user_id, topic)
);

-- Indexes
create index if not exists user_topics_user_id_idx on user_topics(user_id);
create index if not exists user_reactions_user_id_idx on user_reactions(user_id);
create index if not exists user_negative_topics_user_id_idx on user_negative_topics(user_id);
create index if not exists user_negative_topics_topic_idx on user_negative_topics(topic);

-- RLS
alter table user_topics enable row level security;
alter table user_reactions enable row level security;
alter table user_negative_topics enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_topics' and policyname = 'service role all'
  ) then
    create policy "service role all" on user_topics for all using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_reactions' and policyname = 'service role all'
  ) then
    create policy "service role all" on user_reactions for all using (true);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_negative_topics' and policyname = 'service role all'
  ) then
    create policy "service role all" on user_negative_topics for all using (true);
  end if;
end
$$;

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
create index if not exists articles_feed_sort_idx on articles (
  (coalesce(published_at, cached_at, '-infinity'::timestamptz)) desc,
  id desc
);
alter table articles enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'articles' and policyname = 'service role all'
  ) then
    create policy "service role all" on articles for all using (true);
  end if;
end
$$;

-- Add sections and conclusion columns to articles
alter table articles add column if not exists sections jsonb default '[]';
alter table articles add column if not exists conclusion text;

-- Add tavily_raw to preserve original Tavily response data
alter table articles add column if not exists tavily_raw jsonb;
