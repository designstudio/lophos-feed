-- Fix Game Rant classification so anime/game articles do not get forced into League of Legends.
-- The feed is broad enough that "Games" is a safer primary topic than LoL-specific buckets.

update rss_feeds
set topics = array['Games', 'E-sports']
where name = 'Game Rant'
  and url = 'https://gamerant.com/feed/';
