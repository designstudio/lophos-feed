-- ============================================================
-- Tabela: topic_aliases
-- Mapeia variações de tópicos para um tópico canônico
-- Exemplo: "Mestres do Universo" -> "masters of the universe"
-- ============================================================

CREATE TABLE IF NOT EXISTS topic_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_topic TEXT NOT NULL UNIQUE,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_topic_aliases_canonical ON topic_aliases(canonical_topic);

-- Função para normalizar tópico (converte alias para canonical)
CREATE OR REPLACE FUNCTION normalize_topic(p_topic TEXT)
RETURNS TEXT AS $$
DECLARE
  v_normalized TEXT;
  v_canonical TEXT;
BEGIN
  v_normalized := LOWER(TRIM(p_topic));

  -- Verifica se é um alias e retorna o canônico
  SELECT canonical_topic INTO v_canonical
  FROM topic_aliases
  WHERE aliases @> ARRAY[v_normalized]
  LIMIT 1;

  -- Se encontrou como alias, retorna o canônico; senão, retorna o normalizado
  RETURN COALESCE(v_canonical, v_normalized);
END;
$$ LANGUAGE plpgsql STABLE;

-- Inserir exemplos de tópicos com variações
INSERT INTO topic_aliases (canonical_topic, aliases) VALUES
  ('masters of the universe', ARRAY['mestres do universo', 'he-man', 'motu', 'universo dos mestres']),
  ('tecnologia', ARRAY['tech', 'tech news', 'tecnologia']),
  ('games', ARRAY['videogames', 'gaming', 'jogos', 'games']),
  ('cinema', ARRAY['filmes', 'movies', 'filme', 'cinema']),
  ('séries', ARRAY['series', 'tv shows', 'série', 'séries']),
  ('esportes', ARRAY['sports', 'esporte', 'futebol', 'sports']),
  ('política', ARRAY['politics', 'governo', 'eleições', 'politica']),
  ('economia', ARRAY['economics', 'negócios', 'business', 'economia']),
  ('ia', ARRAY['inteligência artificial', 'artificial intelligence', 'ai', 'machine learning', 'deep learning'])
ON CONFLICT (canonical_topic) DO UPDATE SET aliases = EXCLUDED.aliases;

-- RLS (Row Level Security) — públicos por padrão
ALTER TABLE topic_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "topic_aliases_public" ON topic_aliases FOR SELECT USING (TRUE);
