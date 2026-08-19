-- Correct G1 Ciência and add curated esports feeds.
-- Safe to run repeatedly: the URL update is stable and inserts use upsert.

begin;

update public.rss_feeds
set
  url = 'https://g1.globo.com/rss/g1/ciencia',
  name = 'G1 Ciência',
  topics = array['ciencia']::text[],
  language = 'pt',
  active = true,
  last_fetched = null,
  last_etag = null,
  last_modified = null,
  last_error = null,
  last_error_at = null
where name = 'G1 Ciência'
   or url = 'https://g1.globo.com/rss/g1/ciencia-e-saude';

insert into public.rss_feeds (url, name, topics, language, active)
values
  ('https://www.esports.net/feed/', 'Esports.net', array['esports']::text[], 'en', true),
  ('https://esportsinsider.com/feed', 'Esports Insider', array['esports']::text[], 'en', true)
on conflict (url) do update
set
  name = excluded.name,
  topics = excluded.topics,
  language = excluded.language,
  active = true,
  last_error = null,
  last_error_at = null;

commit;

select name, url, topics, language, active
from public.rss_feeds
where name in ('G1 Ciência', 'Esports.net', 'Esports Insider')
order by name;
