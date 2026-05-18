-- Disable Collider in the live rss_feeds catalog without deleting history.
update rss_feeds
set active = false
where lower(name) = 'collider'
   or url = 'https://collider.com/feed/';
