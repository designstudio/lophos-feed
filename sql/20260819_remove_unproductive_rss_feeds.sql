-- Remove RSS catalog entries reviewed on 2026-08-19.
-- Historical raw items and articles are intentionally preserved.

delete from public.rss_feeds
where url in (
  'https://feeds.feedburner.com/www/HbIE5QHYI6H',
  'https://g1.globo.com/rss/g1/natureza',
  'https://otakuusamagazine.com/feed/',
  'https://www.theguardian.com/music/musicblog/rss',
  'https://dotesports.com/feed',
  'https://feeds.feedburner.com/time/world'
);
