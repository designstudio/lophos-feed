-- raw_items: armazena todos os itens brutos dos feeds RSS
create table if not exists raw_items (
  id            uuid default gen_random_uuid() primary key,
  topic         text not null,
  title         text not null,
  url           text not null unique,
  image_url     text,
  content       text,
  summary       text,
  source_name   text not null,
  source_url    text not null,
  pub_date      timestamptz,
  fetched_at    timestamptz default now(),
  dedup_hash    text,         -- hash do titulo normalizado para dedup rapida
  processed     boolean default false  -- true quando ja foi sintetizado pelo Mistral
);

create index if not exists raw_items_topic_idx      on raw_items(topic);
create index if not exists raw_items_pub_date_idx   on raw_items(pub_date desc);
create index if not exists raw_items_processed_idx  on raw_items(processed);
create index if not exists raw_items_dedup_hash_idx on raw_items(dedup_hash);
create index if not exists raw_items_fetched_at_idx on raw_items(fetched_at desc);

alter table raw_items enable row level security;
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'raw_items'
      and policyname = 'service role all'
  ) then
    create policy "service role all" on raw_items for all using (true);
  end if;
end $$;

-- rss_feeds: catalogo de feeds com metadados
create table if not exists rss_feeds (
  id            uuid default gen_random_uuid() primary key,
  url           text not null unique,
  name          text not null,
  topics        text[] not null default '{}',  -- topicos que esse feed cobre
  language      text not null default 'pt',
  active        boolean default true,
  last_fetched  timestamptz,
  last_etag     text,         -- para conditional GET
  last_modified text,
  avg_items_day int default 0,
  created_at    timestamptz default now()
);

create index if not exists rss_feeds_topics_idx  on rss_feeds using gin(topics);
create index if not exists rss_feeds_active_idx  on rss_feeds(active);

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

-- Seed: feeds iniciais curados por topico
insert into rss_feeds (url, name, topics, language) values
  -- Games / Esports
  ('https://dotesports.com/feed', 'Dot Esports', '{"Valorant","League of Legends","TFT","Overwatch"}', 'en'),

  -- Musica
  ('https://www.billboard.com/feed/', 'Billboard', '{"Musica"}', 'en'),

  -- Tecnologia / IA
  ('https://www.theverge.com/rss/index.xml', 'The Verge', '{"Tecnologia","Inteligencia Artificial"}', 'en'),

  -- Noticias gerais BR
  ('https://g1.globo.com/rss/g1/', 'G1', '{"Brasil","Politica","Economia"}', 'pt')
on conflict (url) do nothing;
