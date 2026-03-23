-- Tech category RSS feeds (pilot rollout)
-- Insert 12 curated tech feeds across BR and international sources
-- Each insert is separate to avoid overloading the database

-- Brazilian Tech Feeds
insert into rss_feeds (url, name, topics, language, active) values ('https://rss.tecmundo.com.br/feed', 'TecMundo', '{"tecnologia","gadgets"}', 'pt', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://www.tudocelular.com/feed/', 'Tudo Celular', '{"tecnologia","mobile"}', 'pt', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://www.nextpit.com/feed', 'NextPit', '{"tecnologia","mobile","gadgets"}', 'pt', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://tecnoblog.net/feed/', 'TecnoBlog', '{"tecnologia","gadgets"}', 'pt', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://feeds.feedburner.com/canaltechbr', 'CanalTech', '{"tecnologia","gadgets"}', 'pt', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://olhardigital.com.br/feed/', 'Olhar Digital', '{"tecnologia"}', 'pt', true) on conflict (url) do nothing;

-- International Tech Feeds
insert into rss_feeds (url, name, topics, language, active) values ('https://www.theverge.com/rss/index.xml', 'The Verge', '{"tecnologia","gadgets"}', 'en', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://www.engadget.com/rss.xml', 'Engadget', '{"tecnologia","gadgets"}', 'en', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://arstechnica.com/feed/', 'Ars Technica', '{"tecnologia"}', 'en', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://www.androidauthority.com/feed/', 'Android Authority', '{"tecnologia","mobile"}', 'en', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://feeds.feedburner.com/TechCrunch/', 'TechCrunch', '{"tecnologia","startup"}', 'en', true) on conflict (url) do nothing;
insert into rss_feeds (url, name, topics, language, active) values ('https://feeds.feedburner.com/ign/tech-articles', 'IGN Tech', '{"tecnologia","gadgets"}', 'en', true) on conflict (url) do nothing;
