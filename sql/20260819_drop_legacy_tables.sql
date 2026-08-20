-- Remove tables left behind by retired chat, cache, staging and favorites flows.
-- The active "Minhas curtidas" page is backed by user_reactions, not user_favorites.
-- matched_topic_catalog is intentionally retained because it powers topic autocomplete.

BEGIN;

DROP TABLE IF EXISTS public.chat_messages;
DROP TABLE IF EXISTS public.chat_threads;
DROP TABLE IF EXISTS public.article_reports;
DROP TABLE IF EXISTS public.user_favorites;
DROP TABLE IF EXISTS public.news_cache;
DROP TABLE IF EXISTS public.raw_articles;
DROP TABLE IF EXISTS public.topic_fetches;

COMMIT;

NOTIFY pgrst, 'reload schema';
