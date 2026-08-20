create table if not exists public.editorial_lists (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_json jsonb not null default '{"type":"doc","content":[]}'::jsonb,
  cover_image_url text,
  cover_image_alt text,
  cover_image_credit text,
  topic text not null,
  matched_topics text[] not null default '{}',
  keywords text[] not null default '{}',
  seo_title text,
  seo_description text,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  author_clerk_id text not null,
  author_name text not null,
  author_image_url text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint editorial_lists_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint editorial_lists_published_at_check
    check (status <> 'published' or published_at is not null)
);

create index if not exists editorial_lists_status_published_at_idx
  on public.editorial_lists (status, published_at desc nulls last);

create index if not exists editorial_lists_topic_idx
  on public.editorial_lists (topic);

create index if not exists editorial_lists_matched_topics_idx
  on public.editorial_lists using gin (matched_topics);

create index if not exists editorial_lists_keywords_idx
  on public.editorial_lists using gin (keywords);

alter table public.editorial_lists enable row level security;

revoke all on table public.editorial_lists from anon, authenticated;
grant all on table public.editorial_lists to service_role;

drop policy if exists "service role all" on public.editorial_lists;
create policy "service role all"
  on public.editorial_lists
  for all
  to service_role
  using (true)
  with check (true);

create or replace function public.set_editorial_lists_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists editorial_lists_set_updated_at on public.editorial_lists;
create trigger editorial_lists_set_updated_at
before update on public.editorial_lists
for each row execute function public.set_editorial_lists_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'editorial-media',
  'editorial-media',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
