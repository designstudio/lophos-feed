-- ============================================================
-- MIGRATION: Topic Aliases System
-- Apply this in your Supabase SQL editor to enable topic normalization
-- ============================================================

-- 1. Create topic_aliases table
CREATE TABLE IF NOT EXISTS topic_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_topic TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for fast canonical lookup
CREATE INDEX IF NOT EXISTS idx_topic_aliases_canonical ON topic_aliases(canonical_topic);

-- 2. Create normalize_topic function
-- This function converts any alias to its canonical form
CREATE OR REPLACE FUNCTION normalize_topic(p_topic TEXT)
RETURNS TEXT AS $$
DECLARE
  v_normalized TEXT;
  v_canonical TEXT;
BEGIN
  v_normalized := LOWER(TRIM(COALESCE(p_topic, '')));

  -- Return empty if empty
  IF v_normalized = '' THEN
    RETURN '';
  END IF;

  -- Check if it's an alias and return the canonical form
  SELECT canonical_topic INTO v_canonical
  FROM topic_aliases
  WHERE aliases @> ARRAY[v_normalized]::text[]
  LIMIT 1;

  -- Return canonical if found, otherwise return normalized
  RETURN TRIM(COALESCE(v_canonical, v_normalized));
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Add matched_topics column to articles (if not already present)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS matched_topics TEXT[] DEFAULT '{}';

-- 4. Create index for matched_topics array queries
CREATE INDEX IF NOT EXISTS idx_articles_matched_topics ON articles USING GIN(matched_topics);

-- 5. Insert primary topic aliases
INSERT INTO topic_aliases (canonical_topic, aliases) VALUES
  ('masters of the universe', ARRAY['mestres do universo', 'he-man', 'motu', 'universo dos mestres']),
  ('tecnologia', ARRAY['tech', 'tech news', 'tecnologia']),
  ('games', ARRAY['videogames', 'gaming', 'jogos', 'games']),
  ('cinema', ARRAY['filmes', 'movies', 'filme', 'cinema']),
  ('séries', ARRAY['series', 'tv shows', 'série', 'séries']),
  ('esportes', ARRAY['sports', 'esporte', 'futebol', 'sports']),
  ('política', ARRAY['politics', 'governo', 'eleições', 'politica']),
  ('economia', ARRAY['economics', 'negócios', 'business', 'economia']),
  ('ia', ARRAY['inteligência artificial', 'artificial intelligence', 'ai', 'machine learning', 'deep learning']),
  ('ciência', ARRAY['science', 'científica', 'pesquisa', 'descobertas científicas', 'ciencia']),
  ('mundo', ARRAY['world', 'internacional', 'notícias mundiais', 'global', 'mundo']),
  ('agro', ARRAY['agricultura', 'agropecuária', 'farming', 'agro', 'rural']),
  ('turismo', ARRAY['tourism', 'viagens', 'destinos turísticos', 'turismo', 'travel']),
  ('viagem', ARRAY['travels', 'passeios', 'aventuras', 'viagem', 'viagens']),
  ('horror', ARRAY['terror', 'scary', 'suspenso', 'horror', 'assustador']),
  ('books', ARRAY['livros', 'literatura', 'reading', 'books', 'book']),
  ('anime', ARRAY['mangá', 'manga', 'japanese animation', 'anime']),
  ('music', ARRAY['música', 'songs', 'musica', 'música']),
  ('movies', ARRAY['filmes', 'cinema', 'films', 'movie', 'movies'])
ON CONFLICT (canonical_topic) DO UPDATE SET aliases = EXCLUDED.aliases;

-- 6. Enable RLS (if not already enabled)
ALTER TABLE topic_aliases ENABLE ROW LEVEL SECURITY;
-- Drop and recreate policy to avoid conflicts
DROP POLICY IF EXISTS "topic_aliases_public" ON topic_aliases;
CREATE POLICY "topic_aliases_public" ON topic_aliases FOR SELECT USING (TRUE);

-- 7. Test the function
-- SELECT normalize_topic('mestres do universo') as resultado;
-- SELECT normalize_topic('he-man') as resultado;
-- SELECT normalize_topic('Masters of the Universe') as resultado;
