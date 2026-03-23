-- Tech category RSS feeds (pilot rollout)
-- Insert 12 curated tech feeds across BR and international sources

insert into rss_feeds (url, name, topics, language, active) values
  -- Brazilian Tech Feeds
  ('https://rss.tecmundo.com.br/feed', 'TecMundo', '{"tecnologia","gadgets"}', 'pt', true),
  ('https://www.tudocelular.com/feed/', 'Tudo Celular', '{"tecnologia","mobile"}', 'pt', true),
  ('https://www.nextpit.com/feed', 'NextPit', '{"tecnologia","mobile","gadgets"}', 'pt', true),
  ('https://tecnoblog.net/feed/', 'TecnoBlog', '{"tecnologia","gadgets"}', 'pt', true),
  ('https://feeds.feedburner.com/canaltechbr', 'CanalTech', '{"tecnologia","gadgets"}', 'pt', true),
  ('https://olhardigital.com.br/feed/', 'Olhar Digital', '{"tecnologia"}', 'pt', true),

  -- International Tech Feeds
  ('https://www.theverge.com/rss/index.xml', 'The Verge', '{"tecnologia","gadgets"}', 'en', true),
  ('https://www.engadget.com/rss.xml', 'Engadget', '{"tecnologia","gadgets"}', 'en', true),
  ('https://arstechnica.com/feed/', 'Ars Technica', '{"tecnologia"}', 'en', true),
  ('https://www.androidauthority.com/feed/', 'Android Authority', '{"tecnologia","mobile"}', 'en', true),
  ('https://feeds.feedburner.com/TechCrunch/', 'TechCrunch', '{"tecnologia","startup"}', 'en', true),
  ('https://feeds.feedburner.com/ign/tech-articles', 'IGN Tech', '{"tecnologia","gadgets"}', 'en', true)

on conflict (url) do nothing;
