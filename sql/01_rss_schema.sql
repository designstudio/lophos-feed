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
  dedup_hash    text,         -- hash do título normalizado para dedup rápida
  processed     boolean default false  -- true quando já foi sintetizado pelo Gemini
);

create index if not exists raw_items_topic_idx      on raw_items(topic);
create index if not exists raw_items_pub_date_idx   on raw_items(pub_date desc);
create index if not exists raw_items_processed_idx  on raw_items(processed);
create index if not exists raw_items_dedup_hash_idx on raw_items(dedup_hash);
create index if not exists raw_items_fetched_at_idx on raw_items(fetched_at desc);

alter table raw_items enable row level security;
create policy "service role all" on raw_items for all using (true);

-- rss_feeds: catálogo de feeds com metadados
create table if not exists rss_feeds (
  id            uuid default gen_random_uuid() primary key,
  url           text not null unique,
  name          text not null,
  topics        text[] not null default '{}',  -- tópicos que esse feed cobre
  language      text not null default 'pt',
  active        boolean default true,
  last_fetched  timestamptz,
  last_etag     text,         -- para conditional GET (evita rebaixar feed se não mudou)
  last_modified text,
  avg_items_day int default 0,
  created_at    timestamptz default now()
);

create index if not exists rss_feeds_topics_idx  on rss_feeds using gin(topics);
create index if not exists rss_feeds_active_idx  on rss_feeds(active);

alter table rss_feeds enable row level security;
create policy "service role all" on rss_feeds for all using (true);

-- Seed: feeds iniciais curados por tópico
insert into rss_feeds (url, name, topics, language) values
  -- Games / Esports
  ('https://dotesports.com/feed', 'Dot Esports', '{"Valorant","League of Legends","TFT","Overwatch"}', 'en'),
  ('https://www.riftherald.com/rss/index.xml', 'The Rift Herald', '{"League of Legends"}', 'en'),
  ('https://www.invenglobal.com/rss', 'Inven Global', '{"Valorant","League of Legends"}', 'en'),
  ('https://vlr.gg/rss', 'VLR.gg', '{"Valorant"}', 'en'),
  ('https://www.dbltap.com/rss', 'DBLTAP', '{"Valorant","Overwatch"}', 'en'),
  ('https://gamerant.com/feed/', 'Game Rant', '{"League of Legends","TFT","Overwatch"}', 'en'),

  -- Cinema / Séries / Entretenimento
  ('https://deadline.com/feed/', 'Deadline', '{"Cinema","Séries","Entretenimento"}', 'en'),
  ('https://variety.com/feed/', 'Variety', '{"Cinema","Séries","Entretenimento","Música"}', 'en'),
  ('https://www.hollywoodreporter.com/feed/', 'Hollywood Reporter', '{"Cinema","Séries"}', 'en'),
  ('https://collider.com/feed/', 'Collider', '{"Cinema","Séries"}', 'en'),
  ('https://screenrant.com/feed/', 'Screen Rant', '{"Cinema","Séries"}', 'en'),

  -- Música
  ('https://www.billboard.com/feed/', 'Billboard', '{"Música"}', 'en'),
  ('https://pitchfork.com/rss/news/feed.xml', 'Pitchfork', '{"Música"}', 'en'),
  ('https://www.rollingstone.com/music/feed/', 'Rolling Stone Music', '{"Música"}', 'en'),

  -- Tecnologia / IA
  ('https://techcrunch.com/feed/', 'TechCrunch', '{"Tecnologia","Inteligência Artificial"}', 'en'),
  ('https://www.theverge.com/rss/index.xml', 'The Verge', '{"Tecnologia","Inteligência Artificial"}', 'en'),
  ('https://feeds.arstechnica.com/arstechnica/index', 'Ars Technica', '{"Tecnologia","Inteligência Artificial"}', 'en'),
  ('https://www.wired.com/feed/rss', 'Wired', '{"Tecnologia","Inteligência Artificial"}', 'en'),

  -- Notícias gerais BR
  ('https://g1.globo.com/rss/g1/', 'G1', '{"Brasil","Política","Economia"}', 'pt'),
  ('https://feeds.folha.uol.com.br/folha/mundo/rss091.xml', 'Folha de S.Paulo', '{"Brasil","Mundo"}', 'pt'),
  ('https://rss.uol.com.br/feed/noticias.xml', 'UOL', '{"Brasil"}', 'pt')
on conflict (url) do nothing;
