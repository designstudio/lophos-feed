-- Let the personalized feed walk newest articles first and stop as soon as
-- the requested page is full. Without this index PostgreSQL scans and sorts
-- a large portion of articles even though the API only returns 10 items.
--
-- CONCURRENTLY keeps the production table available while the index is built.
-- Run this migration outside an explicit transaction.

CREATE INDEX CONCURRENTLY IF NOT EXISTS articles_feed_sort_idx
ON public.articles (
  (COALESCE(published_at, cached_at, '-infinity'::timestamptz)) DESC,
  id DESC
);

ANALYZE public.articles;
