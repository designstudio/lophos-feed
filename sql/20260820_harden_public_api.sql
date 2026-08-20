-- The application authenticates with Clerk and reaches Supabase only from the
-- server with service_role. Keep topic aliases publicly readable, but do not
-- expose application data or maintenance RPCs through the publishable key.

BEGIN;

ALTER POLICY "service role all" ON public.articles
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "service role all" ON public.news_preflight_runs
  TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service role all" ON public.raw_items;
DROP POLICY IF EXISTS "service role all" ON public.rss_feeds;
ALTER POLICY "service role all" ON public.user_negative_topics
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "service role all" ON public.user_reactions
  TO service_role USING (true) WITH CHECK (true);
ALTER POLICY "service role all" ON public.user_topics
  TO service_role USING (true) WITH CHECK (true);

ALTER FUNCTION public.get_personalized_feed(text, text[], integer, text[])
  SET search_path = public;
ALTER FUNCTION public.match_topics_for_article(uuid, text, text, text)
  SET search_path = public;
ALTER FUNCTION public.normalize_topic(text)
  SET search_path = public;
ALTER FUNCTION public.update_matched_topics()
  SET search_path = public;

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
GRANT SELECT ON TABLE public.topic_aliases TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.apply_news_retention_batch(timestamptz, timestamptz, timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_personalized_feed(text, text[], integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_personalized_feed_page_v2(text, text[], text[], integer, text[], timestamptz, integer, timestamptz, uuid, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_personalized_feed_page_v2(text, text[], integer, text[], timestamptz, integer, timestamptz, uuid, integer, text[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_topics_for_article(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.normalize_topic(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_matched_topic_catalog() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_matched_topics() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.apply_news_retention_batch(timestamptz, timestamptz, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_personalized_feed(text, text[], integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_personalized_feed_page_v2(text, text[], text[], integer, text[], timestamptz, integer, timestamptz, uuid, integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_personalized_feed_page_v2(text, text[], integer, text[], timestamptz, integer, timestamptz, uuid, integer, text[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.match_topics_for_article(uuid, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.normalize_topic(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_matched_topic_catalog() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_matched_topics() TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';
