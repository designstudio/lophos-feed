-- Community members table
create table if not exists community_members (
  user_id     text primary key,
  invited_by  text,
  created_at  timestamptz default now()
);
alter table community_members enable row level security;
create policy "service role all" on community_members for all using (true);

-- Seed: Henrique as founding member
insert into community_members (user_id, invited_by)
values ('user_3BBgSW8X0ymh0nSEW0aPy05pp4g', 'system')
on conflict (user_id) do nothing;

-- Image suggestions table
create table if not exists image_suggestions (
  id            uuid default gen_random_uuid() primary key,
  article_id    text not null,
  article_title text not null,
  suggested_by  text not null,
  image_url     text not null,
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at    timestamptz default now()
);
create index if not exists image_suggestions_status_idx on image_suggestions(status);
create index if not exists image_suggestions_article_idx on image_suggestions(article_id);
alter table image_suggestions enable row level security;
create policy "service role all" on image_suggestions for all using (true);
