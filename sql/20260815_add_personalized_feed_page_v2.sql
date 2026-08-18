-- Cursor-paginated, feed-only projection.
-- This is intentionally versioned: get_personalized_feed remains untouched.
-- Rollback: DROP FUNCTION IF EXISTS public.get_personalized_feed_page_v2(
--   text, text[], integer, text[], timestamptz, integer, timestamptz, uuid, integer, text[]
-- );

CREATE OR REPLACE FUNCTION public.get_personalized_feed_page_v2(
  p_user_id          TEXT,
  p_topics           TEXT[],
  p_days             INTEGER DEFAULT 2,
  p_excluded_topics  TEXT[] DEFAULT '{}',
  p_snapshot_at      TIMESTAMPTZ DEFAULT NOW(),
  p_cursor_rank      INTEGER DEFAULT NULL,
  p_cursor_sort_at   TIMESTAMPTZ DEFAULT NULL,
  p_cursor_id        UUID DEFAULT NULL,
  p_limit            INTEGER DEFAULT 30,
  p_liked_keywords   TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id                  UUID,
  topic               TEXT,
  title               TEXT,
  summary             TEXT,
  sources             JSONB,
  image_url           TEXT,
  published_at        TIMESTAMPTZ,
  cached_at           TIMESTAMPTZ,
  matched_topics      TEXT[],
  coverage_images     TEXT[],
  feed_rank           INTEGER,
  feed_sort_at        TIMESTAMPTZ,
  feed_liked_keywords TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_liked_keywords     TEXT[];
  v_cutoff             TIMESTAMPTZ;
  v_normalized_topics  TEXT[];
  v_normalized_excluded TEXT[];
BEGIN
  IF p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'p_limit must be between 1 and 100';
  END IF;

  IF (p_cursor_rank IS NULL) <> (p_cursor_sort_at IS NULL)
    OR (p_cursor_rank IS NULL) <> (p_cursor_id IS NULL) THEN
    RAISE EXCEPTION 'cursor fields must be all NULL or all non-NULL';
  END IF;

  IF p_cursor_rank IS NOT NULL AND p_cursor_rank NOT IN (0, 1) THEN
    RAISE EXCEPTION 'p_cursor_rank must be 0 or 1';
  END IF;

  SELECT ARRAY_AGG(DISTINCT normalize_topic(TRIM(value)))
  INTO v_normalized_topics
  FROM UNNEST(p_topics) AS value
  WHERE value IS NOT NULL AND TRIM(value) <> '';

  IF v_normalized_topics IS NULL OR ARRAY_LENGTH(v_normalized_topics, 1) = 0 THEN
    v_normalized_topics := p_topics;
  END IF;

  SELECT ARRAY_AGG(DISTINCT normalize_topic(TRIM(value)))
  INTO v_normalized_excluded
  FROM UNNEST(p_excluded_topics) AS value
  WHERE value IS NOT NULL AND TRIM(value) <> '';

  -- The first page captures the ranking inputs. Later pages replay the encrypted
  -- snapshot supplied by the server, so likes added while scrolling do not reorder it.
  IF p_cursor_rank IS NULL THEN
    SELECT ARRAY_AGG(DISTINCT keyword)
    INTO v_liked_keywords
    FROM (
      SELECT UNNEST(article.keywords) AS keyword
      FROM user_reactions reaction
      JOIN articles article ON article.id = reaction.article_id
      WHERE reaction.user_id = p_user_id
        AND reaction.reaction = 'like'
        AND reaction.created_at >= p_snapshot_at - INTERVAL '48 hours'
        AND reaction.created_at <= p_snapshot_at
    ) liked;
  ELSE
    v_liked_keywords := p_liked_keywords;
  END IF;

  IF p_days = 0 THEN
    v_cutoff := '-infinity'::TIMESTAMPTZ;
  ELSE
    v_cutoff := p_snapshot_at - (p_days || ' days')::INTERVAL;
  END IF;

  RETURN QUERY
  WITH ranked AS (
    SELECT
      article.id,
      article.topic,
      article.title,
      article.summary,
      article.sources,
      article.image_url,
      article.published_at,
      article.cached_at,
      article.matched_topics,
      article.tavily_raw,
      CASE
        WHEN v_liked_keywords IS NOT NULL
          AND article.keywords IS NOT NULL
          AND article.keywords && v_liked_keywords THEN 0
        ELSE 1
      END AS rank_value,
      COALESCE(article.published_at, article.cached_at, '-infinity'::TIMESTAMPTZ) AS sort_value
    FROM articles article
    WHERE article.matched_topics IS NOT NULL
      AND ARRAY_LENGTH(article.matched_topics, 1) > 0
      AND article.matched_topics && v_normalized_topics
      AND (
        v_normalized_excluded IS NULL
        OR ARRAY_LENGTH(v_normalized_excluded, 1) = 0
        OR NOT (article.matched_topics && v_normalized_excluded)
      )
      AND COALESCE(article.published_at, article.cached_at, '-infinity'::TIMESTAMPTZ) >= v_cutoff
      AND COALESCE(article.published_at, article.cached_at, '-infinity'::TIMESTAMPTZ) <= p_snapshot_at
      AND COALESCE(article.cached_at, article.published_at, '-infinity'::TIMESTAMPTZ) <= p_snapshot_at
      AND NOT EXISTS (
        SELECT 1
        FROM user_reactions dislike
        WHERE dislike.user_id = p_user_id
          AND dislike.article_id = article.id
          AND dislike.reaction = 'dislike'
      )
  ), page_rows AS (
    SELECT ranked.*
    FROM ranked
    WHERE p_cursor_rank IS NULL
      OR ranked.rank_value > p_cursor_rank
      OR (
        ranked.rank_value = p_cursor_rank
        AND (
          ranked.sort_value < p_cursor_sort_at
          OR (ranked.sort_value = p_cursor_sort_at AND ranked.id < p_cursor_id)
        )
      )
    ORDER BY ranked.rank_value ASC, ranked.sort_value DESC, ranked.id DESC
    LIMIT p_limit
  ), projected AS (
    SELECT
      page_rows.*,
      coverage.coverage_images,
      ROW_NUMBER() OVER (
        ORDER BY page_rows.rank_value ASC, page_rows.sort_value DESC, page_rows.id DESC
      ) AS page_row_number
    FROM page_rows
    LEFT JOIN LATERAL (
      SELECT ARRAY_AGG(candidate.image ORDER BY candidate.first_position) AS coverage_images
      FROM (
        SELECT image, MIN(position) AS first_position
        FROM (
          SELECT element ->> 'image' AS image, position
          FROM JSONB_ARRAY_ELEMENTS(
            CASE
              WHEN JSONB_TYPEOF(page_rows.tavily_raw) = 'array' THEN page_rows.tavily_raw
              ELSE '[]'::JSONB
            END
          ) WITH ORDINALITY AS result(element, position)
          WHERE position <= 8
        ) extracted
        WHERE image IS NOT NULL
          AND image <> ''
          AND LOWER(image) NOT LIKE '%lazyload%'
          AND LOWER(image) NOT LIKE '%lazy-load%'
          AND LOWER(image) NOT LIKE '%placeholder%'
          AND LOWER(image) NOT LIKE '%blank.gif%'
          AND LOWER(image) NOT LIKE '%spacer.gif%'
          AND LOWER(image) NOT LIKE '%fallback.gif%'
        GROUP BY image
        ORDER BY MIN(position)
        LIMIT 4
      ) candidate
    ) coverage ON TRUE
  )
  SELECT
    projected.id,
    projected.topic,
    projected.title,
    projected.summary,
    projected.sources,
    projected.image_url,
    projected.published_at,
    projected.cached_at,
    projected.matched_topics,
    projected.coverage_images,
    projected.rank_value,
    projected.sort_value,
    CASE WHEN projected.page_row_number = 1 THEN v_liked_keywords ELSE NULL END
  FROM projected
  ORDER BY projected.rank_value ASC, projected.sort_value DESC, projected.id DESC;
END;
$$;

COMMENT ON FUNCTION public.get_personalized_feed_page_v2(
  TEXT, TEXT[], INTEGER, TEXT[], TIMESTAMPTZ, INTEGER, TIMESTAMPTZ, UUID, INTEGER, TEXT[]
) IS 'Stable cursor-paginated FeedItem projection; leaves get_personalized_feed unchanged.';

NOTIFY pgrst, 'reload schema';
