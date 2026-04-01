-- ============================================================
-- RPC: get_personalized_feed
-- Retorna artigos dos tópicos seguidos pelo usuário ordenados por:
--   1. Interseção de keywords com likes recentes (últimas 48h)
--   2. Data de publicação (mais recentes primeiro)
-- Exclui artigos com dislike e tópicos bloqueados.
-- ============================================================
CREATE OR REPLACE FUNCTION get_personalized_feed(
  p_user_id        TEXT,
  p_topics         TEXT[],
  p_days           INT     DEFAULT 2,
  p_excluded_topics TEXT[] DEFAULT '{}'
)
RETURNS SETOF articles
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_liked_kws TEXT[];
  v_cutoff    TIMESTAMPTZ;
  v_normalized_topics TEXT[];
  v_normalized_excluded TEXT[];
BEGIN
  -- Normaliza tópicos do usuário (converte aliases para canônicos)
  SELECT ARRAY_AGG(DISTINCT normalize_topic(t))
  INTO v_normalized_topics
  FROM UNNEST(p_topics) AS t;

  -- Normaliza tópicos excluídos
  SELECT ARRAY_AGG(DISTINCT normalize_topic(t))
  INTO v_normalized_excluded
  FROM UNNEST(p_excluded_topics) AS t
  WHERE t IS NOT NULL AND t != '';

  -- Fallback se arrays forem vazios
  v_normalized_topics := COALESCE(v_normalized_topics, p_topics);
  v_normalized_excluded := COALESCE(v_normalized_excluded, p_excluded_topics);
  -- 1. Agrega as keywords dos artigos que o usuário curtiu nas últimas 48h
  SELECT ARRAY_AGG(DISTINCT kw)
  INTO v_liked_kws
  FROM (
    SELECT UNNEST(a.keywords) AS kw
    FROM user_reactions ur
    JOIN articles a ON a.id = ur.article_id
    WHERE ur.user_id  = p_user_id
      AND ur.reaction = 'like'
      AND ur.created_at >= NOW() - INTERVAL '48 hours'
  ) sub;

  -- 2. Define o corte temporal
  IF p_days = 0 THEN
    v_cutoff := '-infinity'::TIMESTAMPTZ;
  ELSE
    v_cutoff := NOW() - (p_days || ' days')::INTERVAL;
  END IF;

  -- 3. Retorna os artigos com ordenação personalizada
  RETURN QUERY
  SELECT a.*
  FROM articles a
  WHERE
    -- Pertence a pelo menos um tópico do usuário (usando tópicos normalizados)
    a.matched_topics && v_normalized_topics

    -- Não pertence a tópico excluído (usando tópicos normalizados)
    AND (
      ARRAY_LENGTH(v_normalized_excluded, 1) IS NULL
      OR NOT (a.matched_topics && v_normalized_excluded)
    )

    -- Dentro da janela temporal
    AND COALESCE(a.published_at, a.cached_at) >= v_cutoff

    -- Não recebeu dislike do usuário
    AND a.id NOT IN (
      SELECT article_id
      FROM user_reactions
      WHERE user_id = p_user_id
        AND reaction = 'dislike'
    )

  ORDER BY
    -- Artigos com keywords em comum com likes recentes sobem
    CASE
      WHEN v_liked_kws IS NOT NULL
       AND a.keywords IS NOT NULL
       AND a.keywords && v_liked_kws THEN 0
      ELSE 1
    END,
    -- Depois, mais recentes primeiro
    COALESCE(a.published_at, a.cached_at) DESC NULLS LAST;
END;
$$;
