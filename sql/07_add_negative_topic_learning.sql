-- Persist matched_topics on reactions and learn negative topic signals

alter table user_reactions
  add column if not exists matched_topics text[] not null default '{}';

create table if not exists user_negative_topics (
  id uuid default gen_random_uuid() primary key,
  user_id text not null,
  topic text not null,
  dislike_count integer not null default 0,
  first_disliked_at timestamptz default now(),
  last_disliked_at timestamptz default now(),
  unique(user_id, topic)
);

create index if not exists user_negative_topics_user_id_idx on user_negative_topics(user_id);
create index if not exists user_negative_topics_topic_idx on user_negative_topics(topic);

alter table user_negative_topics enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'user_negative_topics'
      and policyname = 'service role all'
  ) then
    create policy "service role all" on user_negative_topics for all using (true);
  end if;
end
$$;
