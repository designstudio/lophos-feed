-- Disable incomplete RSS sources in the live rss_feeds catalog without deleting history.
update rss_feeds
set active = false
where lower(name) in ('collider', 'screen rant', 'hollywood reporter')
   or url in (
     'https://collider.com/feed/',
     'https://screenrant.com/feed/',
     'https://www.hollywoodreporter.com/feed/'
   );
