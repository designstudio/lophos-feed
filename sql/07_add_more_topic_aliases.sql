-- ============================================================
-- Adicionar mais aliases de tópicos
-- ============================================================

INSERT INTO topic_aliases (canonical_topic, aliases) VALUES
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
