create table if not exists article_edits (
  id          uuid default gen_random_uuid() primary key,
  article_id  text not null,
  edited_by   text not null,
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  original    jsonb not null,
  changes     jsonb not null,
  created_at  timestamptz default now()
);
create index if not exists article_edits_status_idx on article_edits(status);
create index if not exists article_edits_article_idx on article_edits(article_id);
alter table article_edits enable row level security;
create policy "service role all" on article_edits for all using (true);
