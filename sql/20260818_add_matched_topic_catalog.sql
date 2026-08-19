-- Compact autocomplete catalog for custom user interests.
-- Standard interest categories continue to use articles.topic; this catalog
-- contains only the values found in articles.matched_topics.

CREATE TABLE IF NOT EXISTS public.matched_topic_catalog (
  topic         TEXT PRIMARY KEY,
  article_count BIGINT NOT NULL DEFAULT 0 CHECK (article_count >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.matched_topic_catalog ENABLE ROW LEVEL SECURITY;

-- The catalog is derived entirely from articles and can be rebuilt safely.
TRUNCATE TABLE public.matched_topic_catalog;

INSERT INTO public.matched_topic_catalog (topic, article_count, updated_at)
SELECT
  LOWER(TRIM(matched_topic)) AS topic,
  COUNT(DISTINCT article.id) AS article_count,
  NOW()
FROM public.articles article
CROSS JOIN LATERAL UNNEST(COALESCE(article.matched_topics, '{}'::TEXT[])) AS matched_topic
WHERE TRIM(matched_topic) <> ''
GROUP BY LOWER(TRIM(matched_topic))
ON CONFLICT (topic) DO UPDATE
SET article_count = EXCLUDED.article_count,
    updated_at = EXCLUDED.updated_at;

CREATE OR REPLACE FUNCTION public.sync_matched_topic_catalog()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  matched_topic TEXT;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    FOR matched_topic IN
      SELECT DISTINCT LOWER(TRIM(value))
      FROM UNNEST(COALESCE(OLD.matched_topics, '{}'::TEXT[])) AS value
      WHERE TRIM(value) <> ''
    LOOP
      UPDATE public.matched_topic_catalog
      SET article_count = GREATEST(article_count - 1, 0),
          updated_at = NOW()
      WHERE topic = matched_topic;
    END LOOP;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    FOR matched_topic IN
      SELECT DISTINCT LOWER(TRIM(value))
      FROM UNNEST(COALESCE(NEW.matched_topics, '{}'::TEXT[])) AS value
      WHERE TRIM(value) <> ''
    LOOP
      INSERT INTO public.matched_topic_catalog (topic, article_count, updated_at)
      VALUES (matched_topic, 1, NOW())
      ON CONFLICT (topic) DO UPDATE
      SET article_count = public.matched_topic_catalog.article_count + 1,
          updated_at = NOW();
    END LOOP;
  END IF;

  DELETE FROM public.matched_topic_catalog WHERE article_count = 0;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_matched_topic_catalog_after_write ON public.articles;
CREATE TRIGGER sync_matched_topic_catalog_after_write
AFTER INSERT OR UPDATE OF matched_topics OR DELETE ON public.articles
FOR EACH ROW EXECUTE FUNCTION public.sync_matched_topic_catalog();

CREATE INDEX IF NOT EXISTS matched_topic_catalog_popularity_idx
ON public.matched_topic_catalog (article_count DESC, topic);

NOTIFY pgrst, 'reload schema';
